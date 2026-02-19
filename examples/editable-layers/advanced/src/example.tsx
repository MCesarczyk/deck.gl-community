import * as React from 'react';
import {useState, useCallback} from 'react';
import DeckGL from '@deck.gl/react';
import {MapView, MapController} from '@deck.gl/core';
import StaticMap from 'react-map-gl/maplibre';
import {GL} from '@luma.gl/constants';

import {
  EditableGeoJsonLayer,
  SelectionLayer,
  ModifyMode,
  TranslateMode,
  DuplicateMode,
  ElevationMode,
  DrawPolygonMode,
  DrawRectangleMode,
  DrawPolygonByDraggingMode,
  ViewMode,
  SnappableMode,
  ElevatedEditHandleLayer,
  GeoJsonEditMode,
  Color,
} from '@deck.gl-community/editable-layers';

import iconSheet from '../../data/edit-handles.png';

import {
  Toolbox,
  ToolboxTitle,
  ToolboxRow,
  ToolboxButton,
} from './toolbox';

type RGBAColor = Color;

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

const ALL_MODES: any = [
  {
    category: '',
    modes: [
      {label: 'View', mode: ViewMode},
      {label: 'Draw Rectangle', mode: DrawRectangleMode},
      {label: 'Modify', mode: ModifyMode},
      {label: 'Translate', mode: new SnappableMode(new TranslateMode())}
    ]
  }
];

function hex2rgb(hex: string) {
  const value = parseInt(hex, 16);
  return [16, 8, 0].map((shift) => ((value >> shift) & 0xff) / 255);
}

const FEATURE_COLORS = [
  '00AEE4',
  'DAF0E3',
  '9BCC32',
  '07A35A',
  'F7DF90',
  'EA376C',
  '6A126A',
  'FCB09B',
  'B0592D',
  'C1B5E3',
  '9C805B',
  'CCDFE5'
].map(hex2rgb);

function getEditHandleTypeFromEitherLayer(handleOrFeature) {
  if (handleOrFeature.__source) {
    return handleOrFeature.__source.object.properties.editHandleType;
  } else if (handleOrFeature.sourceFeature) {
    return handleOrFeature.sourceFeature.feature.properties.editHandleType;
  } else if (handleOrFeature.properties) {
    return handleOrFeature.properties.editHandleType;
  }

  return handleOrFeature.type;
}

function getEditHandleColor(handle: {}): RGBAColor {
  switch (getEditHandleTypeFromEitherLayer(handle)) {
    case 'existing':
      return [0xff, 0x80, 0x00, 0xff];
    case 'snap-source':
      return [0xc0, 0x80, 0xf0, 0xff];
    case 'intermediate':
    default:
      return [0xff, 0xc0, 0x80, 0xff];
  }
}

export function Example() {
  const [viewport, setViewport] = useState<Record<string, any>>(initialViewport);
  const [testFeatures, setTestFeatures] = useState<any>({
    type: 'FeatureCollection',
    features: []
  });
  const [mode, setMode] = useState<typeof GeoJsonEditMode>(() => DrawPolygonMode);
  const [modeConfig, setModeConfig] = useState<any>({
    allowHoles: true,
    allowSelfIntersection: false
  });
  const [selectedFeatureIndexes, setSelectedFeatureIndexes] = useState<number[]>([]);
  const [editHandleType] = useState<string>('point');
  const [selectionTool, setSelectionTool] = useState<string | undefined>(undefined);

  const getDefaultModeConfig = useCallback((mode: any) => {
    if (mode === DrawPolygonMode) {
      return {allowHoles: true, allowSelfIntersection: false};
    }
    return {};
  }, []);

  const onLayerClick = useCallback(
    (info: any) => {
      console.log('onLayerClick', info); // eslint-disable-line
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

  const getDeckColorForFeature = useCallback(
    (index: number, bright: number, alpha: number): RGBAColor => {
      const length = FEATURE_COLORS.length;
      const color = FEATURE_COLORS[index % length].map((c) => c * bright * 255);

      // @ts-expect-error TODO
      return [...color, alpha * 255];
    },
    []
  );

  const renderToolBox = useCallback(() => {
    return (
      <Toolbox>
        {ALL_MODES.map((category) => (
          <ToolboxRow key={category.category}>
            <ToolboxTitle>{category.category} Modes</ToolboxTitle>
            {category.modes.map(({mode: modeOption, label}) => (
              <ToolboxButton
                key={label}
                selected={mode === modeOption}
                onClick={() => {
                  setMode(() => modeOption);
                  setModeConfig(getDefaultModeConfig(modeOption));
                  setSelectionTool(undefined);
                }}
              >
                {label}
              </ToolboxButton>
            ))}
          </ToolboxRow>
        ))}
      </Toolbox>
    );
  }, [mode, testFeatures, editHandleType, getDefaultModeConfig]);

  const renderStaticMap = useCallback((currentViewport: Record<string, any>) => {
    return (
      <StaticMap
        {...currentViewport}
        mapStyle={'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'}
      />
    );
  }, []);

  const onEdit = useCallback(
    ({updatedData, editType, editContext}) => {
      let updatedSelectedFeatureIndexes = selectedFeatureIndexes;

      if (
        ![
          'movePosition',
          'extruding',
          'rotating',
          'translating',
          'scaling',
          'updateTentativeFeature'
        ].includes(editType)
      ) {
        const updatedDataInfo = featuresToInfoString(updatedData);
        // eslint-disable-next-line
        console.log('onEdit', editType, editContext, updatedDataInfo);

        if (editType === 'addHole' || editType === 'invalidHole') {
          // eslint-disable-next-line
          console.log('🕳️ Hole event:', editType, editContext);
        }
      }

      if (editType === 'removePosition') {
        return;
      }

      if (editType === 'addFeature' && mode !== DuplicateMode) {
        const {featureIndexes} = editContext;
        updatedSelectedFeatureIndexes = [...selectedFeatureIndexes, ...featureIndexes];
      }

      setTestFeatures(updatedData);
      setSelectedFeatureIndexes(updatedSelectedFeatureIndexes);
    },
    [selectedFeatureIndexes, mode]
  );

  const getFillColor = useCallback(
    (feature, isSelected) => {
      const index = testFeatures.features.indexOf(feature);
      return isSelected
        ? getDeckColorForFeature(index, 1.0, 0.5)
        : getDeckColorForFeature(index, 0.5, 0.5);
    },
    [testFeatures.features, getDeckColorForFeature]
  );

  const getLineColor = useCallback(
    (feature, isSelected) => {
      const index = testFeatures.features.indexOf(feature);
      return isSelected
        ? getDeckColorForFeature(index, 1.0, 1.0)
        : getDeckColorForFeature(index, 0.5, 1.0);
    },
    [testFeatures.features, getDeckColorForFeature]
  );

  // eslint-disable-next-line complexity
  const currentViewport: Record<string, any> = {
    ...viewport,
    height: window.innerHeight,
    width: window.innerWidth
  };

  let currentModeConfig = modeConfig;

  if (mode === ElevationMode) {
    currentModeConfig = {
      ...currentModeConfig,
      viewport: currentViewport,
      calculateElevationChange: (opts) =>
        ElevationMode.calculateElevationChangeWithViewport(currentViewport, opts)
    };
  } else if (mode === ModifyMode) {
    currentModeConfig = {
      ...currentModeConfig,
      viewport: currentViewport,
      lockRectangles: true
    };
  } else if (mode instanceof SnappableMode && currentModeConfig) {
    if (mode._handler instanceof TranslateMode) {
      currentModeConfig = {
        ...currentModeConfig,
        viewport: currentViewport,
        screenSpace: true
      };
    }

    if (currentModeConfig && currentModeConfig.enableSnapping) {
      currentModeConfig = {
        ...currentModeConfig,
        additionalSnapTargets: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [
                [
                  [-122.52235, 37.734008],
                  [-122.52217, 37.712706],
                  [-122.49436, 37.711979],
                  [-122.49725, 37.734306],
                  [-122.52235, 37.734008]
                ]
              ]
            }
          }
        ]
      };
    }
  } else if (mode === DrawPolygonByDraggingMode) {
    currentModeConfig = {
      ...currentModeConfig,
      throttleMs: 100
    };
  }

  let _subLayerProps = {
    tooltips: {
      getColor: [255, 255, 255, 255]
    }
  };

  if (editHandleType === 'elevated') {
    _subLayerProps = Object.assign(_subLayerProps, {
      guides: {
        _subLayerProps: {
          points: {
            type: ElevatedEditHandleLayer,
            getFillColor: [0, 255, 0]
          }
        }
      }
    });
  }

  const editableGeoJsonLayer = new EditableGeoJsonLayer({
    id: 'geojson',
    data: testFeatures,
    // @ts-expect-error TODO
    selectedFeatureIndexes,
    mode,
    modeConfig: currentModeConfig,
    autoHighlight: false,

    onEdit,

    editHandleType,

    editHandleIconAtlas: iconSheet,
    editHandleIconMapping: {
      intermediate: {
        x: 0,
        y: 0,
        width: 58,
        height: 58,
        mask: false
      },
      existing: {
        x: 58,
        y: 0,
        width: 58,
        height: 58,
        mask: false
      },
      'snap-source': {
        x: 58,
        y: 0,
        width: 58,
        height: 58,
        mask: false
      },
      'snap-target': {
        x: 0,
        y: 0,
        width: 58,
        height: 58,
        mask: false
      }
    },
    getEditHandleIcon: (d) => getEditHandleTypeFromEitherLayer(d),
    getEditHandleIconSize: 40,
    getEditHandleIconColor: getEditHandleColor,

    lineWidthMinPixels: 2,
    pointRadiusMinPixels: 5,
    getLineDashArray: () => [0, 0],

    getFillColor,
    getLineColor,

    getEditHandlePointColor: getEditHandleColor,
    editHandlePointRadiusScale: 2,

    getTentativeLineDashArray: () => [7, 4],
    getTentativeLineColor: () => [0x8f, 0x8f, 0x8f, 0xff],

    _subLayerProps,

    parameters: {
      depthTest: true,
      depthMask: false,

      blend: true,
      blendEquation: GL.FUNC_ADD,
      blendFunc: [GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA]
    }
  });

  const layers = [editableGeoJsonLayer];

  if (selectionTool) {
    layers.push(
      // @ts-expect-error TODO
      new SelectionLayer({
        id: 'selection',
        selectionType: selectionTool,
        onSelect: ({pickingInfos}) => {
          setSelectedFeatureIndexes(pickingInfos.map((pi) => pi.index));
        },
        layerIds: ['geojson'],

        getTentativeFillColor: () => [255, 0, 255, 100],
        getTentativeLineColor: () => [0, 0, 255, 255],
        lineWidthMinPixels: 3
      })
    );
  }

  return (
    <div style={styles.mapContainer}>
      <DeckGL
        viewState={currentViewport}
        getCursor={editableGeoJsonLayer.getCursor.bind(editableGeoJsonLayer)}
        layers={layers}
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

export default Example;

function featuresToInfoString(featureCollection: any): string {
  const info = featureCollection.features.map(
    (feature) => `${feature.geometry.type}(${getPositionCount(feature.geometry)})`
  );

  return JSON.stringify(info);
}

function getPositionCount(geometry): number {
  const flatMap = (f, arr) => arr.reduce((x, y) => [...x, ...f(y)], []);

  const {type, coordinates} = geometry;
  switch (type) {
    case 'Point':
      return 1;
    case 'LineString':
    case 'MultiPoint':
      return coordinates.length;
    case 'Polygon':
    case 'MultiLineString':
      return flatMap((x) => x, coordinates).length;
    case 'MultiPolygon':
      return flatMap((x) => flatMap((y) => y, x), coordinates).length;
    default:
      throw Error(`Unknown geometry type: ${type}`);
  }
}
