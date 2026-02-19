import * as React from 'react';
import {useState, useCallback} from 'react';
import DeckGL from '@deck.gl/react';
import {MapView, MapController} from '@deck.gl/core';
import StaticMap from 'react-map-gl/maplibre';

import {ViewMode, GeoJsonEditMode} from '@deck.gl-community/editable-layers';

import {useToolbox} from './useToolbox';
import {useEditableGeojsonLayer} from './useEditableGeojsonLayer';

const styles = {
  mapContainer: {
    alignItems: 'stretch',
    display: 'flex',
    height: '100vh'
  },
  checkbox: {
    margin: 10
  }
};

const initialViewport = {
  bearing: 0,
  height: 0,
  latitude: 37.76,
  longitude: -122.44,
  pitch: 0,
  width: 0,
  zoom: 11
};

export function Example() {
  const [viewport, setViewport] = useState<Record<string, any>>(initialViewport);
  const [mode, setMode] = useState<typeof GeoJsonEditMode>(() => ViewMode);
  const [selectedFeatureIndexes, setSelectedFeatureIndexes] = useState<number[]>([]);
  const [selectionTool, setSelectionTool] = useState<string | undefined>(undefined);

  const onLayerClick = useCallback(
    (info: any) => {
      if (mode !== ViewMode || selectionTool) {
        return;
      }

      if (info) {
        console.log(`select editing feature ${info.index}`); // eslint-disable-line
        setSelectedFeatureIndexes([info.index]);
      } else {
        console.log('deselect editing feature'); // eslint-disable-line
        setSelectedFeatureIndexes([]);
      }
    },
    [mode, selectionTool]
  );

  const {features, editableGeoJsonLayer} = useEditableGeojsonLayer({
    viewport,
    mode,
    selectedFeatureIndexes,
    setSelectedFeatureIndexes
  });

  const {renderToolBox} = useToolbox({
    features: features,
    mode,
    setMode,
    setSelectionTool
  });

  const renderStaticMap = useCallback((currentViewport: Record<string, any>) => {
    return (
      <StaticMap
        {...currentViewport}
        mapStyle={'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'}
      />
    );
  }, []);

  const currentViewport: Record<string, any> = {
    ...viewport,
    height: window.innerHeight,
    width: window.innerWidth
  };

  return (
    <div style={styles.mapContainer}>
      <DeckGL
        viewState={currentViewport}
        getCursor={editableGeoJsonLayer.getCursor.bind(editableGeoJsonLayer)}
        // @ts-expect-error Type mismatch: 'EditableGeoJsonLayer[]' is not assignable to type 'LayersList'.
        layers={[editableGeoJsonLayer]}
        height="100%"
        width="100%"
        views={[
          new MapView({
            id: 'basemap',
            controller: {
              type: MapController,
              doubleClickZoom: false
            }
          })
        ]}
        onClick={onLayerClick}
        onViewStateChange={({viewState}) => setViewport(viewState)}
      >
        {renderStaticMap(currentViewport)}
      </DeckGL>
      {renderToolBox()}
    </div>
  );
}
