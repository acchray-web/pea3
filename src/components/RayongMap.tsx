/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Patient, OutageReport } from '../types';
import { ShieldAlert, Zap, Compass, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';

interface RayongMapProps {
  viewMode: 'login' | 'user' | 'admin';
  patients: Patient[];
  reports: OutageReport[];
  selectedPatientId?: number | null;
  onPatientSelect?: (id: number) => void;
  onMapClick?: (lat: number, lng: number) => void;
  userLocation?: [number, number] | null;
  outagePlacementMode?: boolean; // Admin Draw Area mode
  simulationCircle?: { lat: number; lng: number; radius: number } | null;
  isDarkMode?: boolean;
}

export default function RayongMap({
  viewMode,
  patients,
  reports,
  selectedPatientId,
  onPatientSelect,
  onMapClick,
  userLocation,
  outagePlacementMode = false,
  simulationCircle,
  isDarkMode = true,
}: RayongMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  
  // Layer groups to clear & update dynamically without full re-render
  const patientLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const outageLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const userLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const simulationLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Track latest map click handler reference to avoid stale closures in Leaflet events
  const onMapClickRef = useRef(onMapClick);
  useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // Center coordinate for Rayong Hospital / City Center
  const rayongCenter: [number, number] = [12.682, 101.278];

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create Map
    const map = L.map(mapContainerRef.current, {
      center: rayongCenter,
      zoom: 13,
      zoomControl: false, // Standard controls disabled to use custom high-end UI overlay
      attributionControl: false,
    });

    mapRef.current = map;

    // Create Layer groups
    patientLayerGroupRef.current = L.layerGroup().addTo(map);
    outageLayerGroupRef.current = L.layerGroup().addTo(map);
    userLayerGroupRef.current = L.layerGroup().addTo(map);
    simulationLayerGroupRef.current = L.layerGroup().addTo(map);

    // Click handler for area drawing/outage center simulation
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update tile layers dynamically based on isDarkMode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const lightTiles = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    const darkTiles = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'; // default OSM dark look

    tileLayerRef.current = L.tileLayer(isDarkMode ? darkTiles : lightTiles, {
      maxZoom: 19,
    }).addTo(map);
  }, [isDarkMode]);

  // Update User Location Marker
  useEffect(() => {
    const map = mapRef.current;
    const layer = userLayerGroupRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (userLocation) {
      const userSvg = `
        <div class="relative w-8 h-8 flex items-center justify-center">
          <span class="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75 animate-ping"></span>
          <div class="relative w-4 h-4 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center">
            <span class="w-1.5 h-1.5 bg-white rounded-full"></span>
          </div>
        </div>
      `;

      const userIcon = L.divIcon({
        html: userSvg,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker(userLocation, { icon: userIcon })
        .addTo(layer)
        .bindPopup(`
          <div class="text-xs font-sans text-gray-800 p-1">
            <p class="font-bold text-blue-600">📍 ตำแหน่งของคุณปัจจุบัน (GPS)</p>
            <p class="text-[10px] text-gray-500 mt-1">Lat: ${userLocation[0].toFixed(5)} Lng: ${userLocation[1].toFixed(5)}</p>
          </div>
        `);
    }
  }, [userLocation]);

  // Update Simulation Circle (Draw Mode)
  useEffect(() => {
    const map = mapRef.current;
    const layer = simulationLayerGroupRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (simulationCircle) {
      const { lat, lng, radius } = simulationCircle;

      // Pulse circle
      L.circle([lat, lng], {
        radius: radius * 1000, // convert km to meters
        color: '#ef4444',
        fillColor: '#f87171',
        fillOpacity: 0.15,
        weight: 3,
        dashArray: '5, 10',
      }).addTo(layer);

      // Simulation center pin icon
      const centerSvg = `
        <div class="w-10 h-10 flex items-center justify-center bg-red-950 border-2 border-red-500 rounded-full text-red-400 marker-beacon-critical">
          <svg class="w-5 h-5 animate-pulse" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
      `;

      const centerIcon = L.divIcon({
        html: centerSvg,
        className: '',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      L.marker([lat, lng], { icon: centerIcon })
        .addTo(layer)
        .bindPopup(`
          <div class="text-xs font-sans text-red-900 p-1">
            <span class="font-bold flex items-center gap-1 text-red-600"><Zap class="w-3.5 h-3.5" /> จุดจำลอง/รายงานไฟดับ</span>
            <p class="mt-1 text-gray-600">รัศมีผลกระทบ: <span class="font-bold text-red-500">${radius} กม.</span></p>
          </div>
        `);
    }
  }, [simulationCircle]);

  // Update Outage Reports Overlay
  useEffect(() => {
    const map = mapRef.current;
    const layer = outageLayerGroupRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // In Login & User Mode, show ONLY outage reports.
    // In Admin Mode, show outage reports alongside patients.
    reports.forEach((report) => {
      if (report.status?.toUpperCase() !== 'PENDING') return; // only display active outages

      // Radial boundary ring
      L.circle([report.latitude, report.longitude], {
        radius: report.radius * 1000,
        color: '#f97316',
        fillColor: '#fdba74',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '3, 6',
      }).addTo(layer);

      // Pin icon
      const pinSvg = `
        <div class="w-8 h-8 flex items-center justify-center bg-amber-950 border border-amber-500 rounded-full text-amber-500 marker-beacon-critical">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
        </div>
      `;

      const pinIcon = L.divIcon({
        html: pinSvg,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([report.latitude, report.longitude], { icon: pinIcon })
        .addTo(layer)
        .bindPopup(`
          <div class="text-xs font-sans text-gray-800 p-1 max-w-[180px]">
            <p class="font-bold text-orange-600 flex items-center gap-1">⚠️ ไฟฟ้าดับฉุกเฉิน</p>
            <p class="text-gray-600 mt-1 font-medium">${report.address}</p>
            <p class="text-[10px] text-gray-500 mt-1">รัศมีผลกระทบ: <span class="font-bold">${report.radius} กม.</span></p>
            <p class="text-[10px] text-gray-400">แจ้งโดย: ${report.reporter_phone}</p>
          </div>
        `);
    });
  }, [reports]);

  // Update Patients Layer (Admin-only or restricted view, NEVER login or general user)
  useEffect(() => {
    const map = mapRef.current;
    const layer = patientLayerGroupRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    // SECURITY COMPLIANCE DETECT:
    // If view mode is NOT admin, we DO NOT render any other patients on the map.
    if (viewMode !== 'admin') {
      return;
    }

    patients.forEach((patient) => {
      // Pick color theme based on Priority
      let bgClass = 'bg-emerald-500';
      let borderClass = 'border-emerald-200';
      let textClass = 'text-emerald-500';
      let ledClass = 'rgba(16, 185, 129, 0.4)';
      let pulseStyleClass = 'marker-beacon-normal';

      if (patient.priority === 'CRITICAL') {
        bgClass = 'bg-red-600';
        borderClass = 'border-red-400';
        textClass = 'text-red-500';
        ledClass = 'rgba(239, 68, 68, 1)';
        pulseStyleClass = 'marker-beacon-critical';
      } else if (patient.priority === 'HIGH') {
        bgClass = 'bg-orange-500';
        borderClass = 'border-orange-300';
        textClass = 'text-orange-500';
        ledClass = 'rgba(249, 115, 22, 0.8)';
        pulseStyleClass = 'marker-beacon-critical';
      } else if (patient.priority === 'MEDIUM') {
        bgClass = 'bg-yellow-500';
        borderClass = 'border-yellow-200';
        textClass = 'text-yellow-500';
        ledClass = 'rgba(234, 179, 8, 0.6)';
        pulseStyleClass = 'marker-beacon-normal';
      } else {
        // LOW
        bgClass = 'bg-cyan-500';
        borderClass = 'border-cyan-200';
        textClass = 'text-cyan-500';
        ledClass = 'rgba(6, 182, 212, 0.4)';
      }

      // If patient's electricity status is currently OUTAGE_AFFECTED, make it look hyper-critical and highlight with alert sign!
      const inOutage = patient.status?.toUpperCase() === 'OUTAGE_AFFECTED';

      const circleSvg = `
        <div class="relative flex items-center justify-center w-8 h-8 ${pulseStyleClass}">
          ${inOutage ? `
            <!-- Blackout warning flashing background banner -->
            <span class="absolute inline-flex h-full w-full rounded-full bg-red-600 opacity-90 animate-ping"></span>
            <div class="relative w-7 h-7 bg-red-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg text-white font-black text-xs">
              ⚠️
            </div>
          ` : `
            <!-- Normal Status Beacon with custom LED rings -->
            <span class="absolute inline-flex h-full w-full rounded-full bg-[${ledClass}] opacity-60"></span>
            <div class="relative w-5 h-5 ${bgClass} rounded-full border-2 border-slate-900 flex items-center justify-center shadow-md">
              <span class="w-1.5 h-1.5 bg-white rounded-full"></span>
            </div>
          `}
        </div>
      `;

      const divIcon = L.divIcon({
        html: circleSvg,
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const patientMarker = L.marker([patient.latitude, patient.longitude], { icon: divIcon })
        .addTo(layer)
        .bindPopup(`
          <div class="text-xs font-sans text-gray-800 p-1.5 max-w-[220px]">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${
                patient.priority === 'CRITICAL' ? 'bg-red-600' :
                patient.priority === 'HIGH' ? 'bg-orange-500' :
                patient.priority === 'MEDIUM' ? 'bg-yellow-600' : 'bg-cyan-600'
              }">
                ${patient.priority}
              </span>
              ${inOutage ? '<span class="text-red-600 font-bold animate-pulse text-[11px]">⚠️ ไฟดับแล้ว!</span>' : '<span class="text-emerald-600 text-[10px]">🟢 ไฟปกติ</span>'}
            </div>
            <p class="font-bold text-slate-950 text-xs">${patient.name}</p>
            <p class="text-gray-500 text-[10px] leading-tight mt-1">🩺 ${patient.equipment}</p>
            <p class="text-blue-500 font-bold mt-1.5 text-[10px] cursor-pointer" onclick="window.parent.dispatchEvent(new CustomEvent('focus-p', {detail: ${patient.id}}))">
              📞 โทร: ${patient.phone}
            </p>
            <p class="text-gray-400 text-[9px] mt-1">${patient.address}</p>
          </div>
        `);

      // Clicking marker triggers select focus details (only for admins)
      patientMarker.on('click', () => {
        if (onPatientSelect) {
          onPatientSelect(patient.id);
        }
      });
    });
  }, [patients, viewMode, reports]);

  // Map Navigation: Smooth Fly-to Animation when selectedPatientId changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPatientId) return;

    const focusedPatient = patients.find((p) => p.id === selectedPatientId);
    if (focusedPatient) {
      map.flyTo([focusedPatient.latitude, focusedPatient.longitude], 16, {
        animate: true,
        duration: 1.5,
      });
    }
  }, [selectedPatientId, patients]);

  // Reset view to Mueang Rayong default bounds
  const handleResetView = () => {
    if (mapRef.current) {
      mapRef.current.flyTo(rayongCenter, 13, { animate: true, duration: 1.0 });
    }
  };

  // Zoom helpers
  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-2xl border border-slate-200">
      {/* Map Division Ref */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Control Overlay tools */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={handleResetView}
          className="p-2.5 bg-slate-900/90 text-slate-100 hover:text-white rounded-lg border border-slate-700 shadow-md backdrop-blur-md transition-all flex items-center justify-center"
          title="ศูนย์รวมเมืองระยอง (Rayong Center)"
        >
          <Compass className="w-4 h-4 text-emerald-400" />
        </button>
        <button
          onClick={handleZoomIn}
          className="p-2.5 bg-slate-900/90 text-slate-100 hover:text-white rounded-lg border border-slate-700 shadow-md backdrop-blur-md transition-all flex items-center justify-center"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2.5 bg-slate-900/90 text-slate-100 hover:text-white rounded-lg border border-slate-700 shadow-md backdrop-blur-md transition-all flex items-center justify-center"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
      </div>

      {outagePlacementMode && (
        <div className="absolute top-4 right-4 z-[1000] bg-red-950/95 border border-red-500/50 px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 animate-pulse">
          <ShieldAlert className="w-4 h-4 text-red-500" />
          <span className="text-[11px] font-mono font-medium text-red-200">
            โหมดจัดพิกัดไฟดับ: คลิกพิกัดบนแผนที่เพื่อระบุศูนย์กลาง
          </span>
        </div>
      )}

      {/* Info indicator in map footer */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-slate-950/90 border border-slate-800/80 px-2.5 py-1 rounded-md text-[9px] font-mono text-slate-400 pointer-events-none flex items-center gap-1.5">
        <Compass className="w-3 h-3 text-slate-500 animate-spin" style={{ animationDuration: '6s' }} />
        <span>RAYONG GIS NODE [OSM / CARTODB]</span>
      </div>
    </div>
  );
}
