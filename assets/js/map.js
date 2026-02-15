/**
 * Folklore Database — Map page
 * Leaflet + OSM tiles + MarkerCluster; client-side filtering from index.json; URL state.
 */
(function () {
  'use strict';

  const BASE = typeof window.FOLKLORE_MAP_BASE !== 'undefined' ? window.FOLKLORE_MAP_BASE : '';
  const INDEX_URL = typeof window.FOLKLORE_MAP_INDEX_URL !== 'undefined' ? window.FOLKLORE_MAP_INDEX_URL : (BASE + 'map/index.json');

  let entries = [];
  let map = null;
  let markersLayer = null;
  let clusterGroup = null;
  let markerByUrl = Object.create(null);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- URL state ----------
  function getQueryState() {
    const params = new URLSearchParams(window.location.search);
    return {
      q: (params.get('q') || '').trim(),
      tags: params.get('tags') ? params.get('tags').split(',').map(function (t) { return t.trim(); }).filter(Boolean) : []
    };
  }

  function setQueryState(state) {
    const params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.tags.length) params.set('tags', state.tags.join(','));
    const search = params.toString();
    const url = window.location.pathname + (search ? '?' + search : '');
    window.history.replaceState({}, '', url);
  }

  // ---------- Filtering ----------
  function matchEntry(entry, q, tagSet) {
    const qLower = q.toLowerCase();
    const fields = [entry.title, entry.place, entry.county, entry.region].concat(entry.tags || []);
    const matchQ = !q || fields.some(function (f) { return String(f).toLowerCase().includes(qLower); });
    const matchTags = tagSet.size === 0 || (entry.tags || []).some(function (t) { return tagSet.has(String(t).toLowerCase()); });
    return matchQ && matchTags;
  }

  function applyFilters() {
    const state = getQueryState();
    const tagSet = new Set(state.tags.map(function (t) { return t.toLowerCase(); }));
    return entries.filter(function (e) { return matchEntry(e, state.q, tagSet); });
  }

  // ---------- Map ----------
  function slugFromUrl(url) {
    if (!url) return '';
    const parts = url.replace(/\/$/, '').split('/');
    return parts[parts.length - 1] || '';
  }

  function createPopupContent(entry) {
    const title = escapeHtml(entry.title);
    const place = escapeHtml([entry.place, entry.county].filter(Boolean).join(', '));
    const link = '<a href="' + escapeAttr(entry.url) + '">Read more</a>';
    return '<div class="map-popup"><strong>' + title + '</strong><br>' + place + '<br>' + link + '</div>';
  }

  function addMarkers(filtered) {
    if (clusterGroup) {
      map.removeLayer(clusterGroup);
      markerByUrl = Object.create(null);
    }
    clusterGroup = typeof L.markerClusterGroup === 'function'
      ? L.markerClusterGroup({ animate: !reduceMotion })
      : L.layerGroup();
    filtered.forEach(function (entry) {
      const lat = Number(entry.lat);
      const lng = Number(entry.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      const marker = L.marker([lat, lng]);
      marker.entry = entry;
      marker.bindPopup(createPopupContent(entry), { className: 'folklore-popup' });
      marker.on('popupopen', function () {
        highlightResultItem(entry.url);
      });
      clusterGroup.addLayer(marker);
      markerByUrl[entry.url] = marker;
    });
    map.addLayer(clusterGroup);
  }

  function highlightResultItem(url) {
    document.querySelectorAll('#results-list [data-entry-url]').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-entry-url') === url);
    });
  }

  function flyToMarker(url) {
    const marker = markerByUrl[url];
    if (!marker || !map) return;
    const latlng = marker.getLatLng();
    if (reduceMotion) {
      map.setView(latlng, map.getZoom());
    } else {
      map.flyTo(latlng, Math.max(map.getZoom(), 12));
    }
    marker.openPopup();
    highlightResultItem(url);
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---------- UI: chips ----------
  function getUniqueTags() {
    const set = new Set();
    entries.forEach(function (e) {
      (e.tags || []).forEach(function (t) { set.add(t); });
    });
    return Array.from(set).sort();
  }

  function renderTagChips(selectedTags) {
    const container = document.getElementById('tag-chips');
    if (!container) return;
    const tags = getUniqueTags();
    container.innerHTML = '';
    tags.forEach(function (tag) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tag-chip' + (selectedTags.indexOf(tag) >= 0 ? ' tag-chip-active' : '');
      btn.setAttribute('role', 'checkbox');
      btn.setAttribute('aria-checked', selectedTags.indexOf(tag) >= 0 ? 'true' : 'false');
      btn.textContent = tag;
      btn.dataset.tag = tag;
      btn.addEventListener('click', function () {
        toggleTag(tag);
      });
      btn.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleTag(tag);
        }
      });
      container.appendChild(btn);
    });
  }

  function toggleTag(tag) {
    const state = getQueryState();
    const idx = state.tags.map(function (t) { return t.toLowerCase(); }).indexOf(tag.toLowerCase());
    if (idx >= 0) state.tags.splice(idx, 1);
    else state.tags.push(tag);
    state.tags.sort();
    setQueryState(state);
    renderTagChips(state.tags);
    runFilters();
  }

  function runFilters() {
    const filtered = applyFilters();
    addMarkers(filtered);
    renderResults(filtered);
    updateClearButton();
  }

  function updateClearButton() {
    const state = getQueryState();
    const btn = document.getElementById('clear-filters');
    if (btn) btn.disabled = !state.q && state.tags.length === 0;
  }

  // ---------- UI: results list ----------
  function renderResults(filtered) {
    const list = document.getElementById('results-list');
    const empty = document.getElementById('results-empty');
    if (!list) return;
    list.innerHTML = '';
    if (empty) empty.hidden = true;
    filtered.forEach(function (entry) {
      const li = document.createElement('li');
      li.className = 'result-item';
      li.setAttribute('data-entry-url', entry.url);
      const placeCounty = [entry.place, entry.county].filter(Boolean).join(', ');
      li.setAttribute('role', 'button');
      li.tabIndex = 0;
      li.innerHTML = '<span class="result-title">' + escapeHtml(entry.title) + '</span>' +
        (placeCounty ? '<span class="result-meta">' + placeCounty + '</span>' : '') +
        ' <a href="' + escapeAttr(entry.url) + '" class="result-read-more">Read more</a>';
      li.addEventListener('click', function (e) {
        if (e.target.classList.contains('result-read-more')) return; // let link work
        e.preventDefault();
        flyToMarker(entry.url);
      });
      li.addEventListener('keydown', function (e) {
        if (e.target.classList.contains('result-read-more')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          flyToMarker(entry.url);
        }
      });
      list.appendChild(li);
    });
    if (empty && filtered.length === 0) {
      empty.hidden = false;
    }
  }

  // ---------- Search ----------
  function bindSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    let timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        const state = getQueryState();
        state.q = input.value.trim();
        setQueryState(state);
        runFilters();
      }, 150);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        input.value = '';
        const state = getQueryState();
        state.q = '';
        setQueryState(state);
        renderTagChips(state.tags);
        runFilters();
      }
    });
  }

  // ---------- Clear filters ----------
  function bindClearFilters() {
    const btn = document.getElementById('clear-filters');
    if (!btn) return;
    btn.addEventListener('click', function () {
      const state = { q: '', tags: [] };
      setQueryState(state);
      const input = document.getElementById('search-input');
      if (input) input.value = '';
      renderTagChips([]);
      runFilters();
    });
  }

  // ---------- Panel toggle (mobile) ----------
  function bindPanelToggle() {
    const toggle = document.getElementById('panel-toggle');
    const content = document.getElementById('results-panel-content');
    if (!toggle || !content) return;
    toggle.addEventListener('click', function () {
      const expanded = content.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      toggle.querySelector('.toggle-label').textContent = expanded ? 'Hide filters & results' : 'Show filters & results';
    });
  }

  // ---------- Init map ----------
  function initMap() {
    const el = document.getElementById('map');
    if (!el) return;
    map = L.map(el, {
      center: [53.3, -7.7],
      zoom: 7,
      zoomControl: true
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(map);
    L.control.zoom({ position: 'topright' }).addTo(map);
  }

  // ---------- Load index and bootstrap ----------
  function init() {
    initMap();
    bindSearch();
    bindClearFilters();
    bindPanelToggle();

    fetch(INDEX_URL, { cache: 'default' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        entries = Array.isArray(data) ? data : [];
        const state = getQueryState();
        const input = document.getElementById('search-input');
        if (input) input.value = state.q;
        renderTagChips(state.tags);
        runFilters();
      })
      .catch(function () {
        entries = [];
        renderResults([]);
        document.getElementById('results-empty').hidden = false;
        document.getElementById('results-empty').textContent = 'Could not load entries.';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
