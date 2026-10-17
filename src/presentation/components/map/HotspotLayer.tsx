'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Popup, useMap } from 'react-leaflet';
import Supercluster from 'supercluster';
import type { Map as LeafletMap } from 'leaflet';
import type { HotspotPointFeature, HotspotPointProperties } from '@/presentation/types';

const FRP_STYLE: Array<{ max: number; color: string; radius: number }> = [
  { max: 10, color: '#65a30d', radius: 4 },
  { max: 30, color: '#f59e0b', radius: 6 },
  { max: 60, color: '#ea580c', radius: 8 },
  { max: Infinity, color: '#dc2626', radius: 11 },
];

export function getFrpStyle(frp: number) {
  return FRP_STYLE.find((t) => frp < t.max) ?? FRP_STYLE[FRP_STYLE.length - 1];
}

interface MapView {
  bbox: [number, number, number, number];
  zoom: number;
}

function readView(map: LeafletMap): MapView {
  const b = map.getBounds();
  return {
    bbox: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()],
    zoom: Math.round(map.getZoom()),
  };
}

interface HotspotLayerProps {
  hotspots: HotspotPointFeature[];
}

function isClusterProperties(
  props: HotspotPointProperties | Record<string, unknown>,
): props is { cluster: true; cluster_id: number; point_count: number } {
  return 'cluster' in props && props.cluster === true;
}

export function HotspotLayer({ hotspots }: HotspotLayerProps) {
  const map = useMap();
  const [view, setView] = useState<MapView>(() => readView(map));

  useEffect(() => {
    const onMoveEnd = () => setView(readView(map));
    map.on('moveend', onMoveEnd);
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [map]);

  const clusterIndex = useMemo(() => {
    const index = new Supercluster<HotspotPointProperties>({
      radius: 60,
      maxZoom: 16,
      minPoints: 3,
    });
    index.load(hotspots);
    return index;
  }, [hotspots]);

  const clusters = useMemo(
    () => clusterIndex.getClusters(view.bbox, view.zoom),
    [clusterIndex, view],
  );

  return (
    <>
      {clusters.map((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        if (isClusterProperties(props)) {
          return (
            <CircleMarker
              key={`cluster-${props.cluster_id}`}
              center={[lat, lng]}
              radius={Math.min(20, 8 + Math.log2(props.point_count))}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.45,
                weight: 2,
              }}
              eventHandlers={{
                click: () => {
                  const expansionZoom = Math.min(
                    clusterIndex.getClusterExpansionZoom(props.cluster_id),
                    16,
                  );
                  map.setView([lat, lng], expansionZoom);
                },
              }}
            >
              <Popup>
                <p className="font-bold text-xs">{props.point_count} focos de calor</p>
              </Popup>
            </CircleMarker>
          );
        }

        const pointProps = props as HotspotPointProperties;
        const style = getFrpStyle(pointProps.frp);
        return (
          <CircleMarker
            key={pointProps.id}
            center={[lat, lng]}
            radius={style.radius}
            pathOptions={{
              color: style.color,
              fillColor: style.color,
              fillOpacity: 0.75,
              weight: 1,
            }}
          >
            <Popup>
              <div className="space-y-1 text-xs">
                <p className="font-bold">Foco de calor</p>
                <p>FRP: {pointProps.frp.toFixed(1)} MW</p>
                <p>Confianza: {pointProps.confidence === 'h' ? 'Alta' : 'Normal'}</p>
                <p>Satélite: {pointProps.satellite}</p>
                <p>Adquisición: {pointProps.acquisitionDate}</p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}