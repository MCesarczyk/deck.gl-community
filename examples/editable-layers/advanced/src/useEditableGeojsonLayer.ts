import {useCallback, useState} from 'react';
import {GL} from '@luma.gl/constants';

import {
  EditableGeoJsonLayer,
  ModifyMode,
  TranslateMode,
  DuplicateMode,
  SnappableMode,
  Color,
  GeoJsonEditMode,
  SimpleFeature
} from '@deck.gl-community/editable-layers';

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

interface UseEditableGeojsonLayerProps {
  viewport: Record<string, number>;
  mode: typeof GeoJsonEditMode;
  selectedFeatureIndexes: number[];
  setSelectedFeatureIndexes: (indexes: number[]) => void;
}

export const useEditableGeojsonLayer = ({
  viewport,
  mode,
  selectedFeatureIndexes,
  setSelectedFeatureIndexes
}: UseEditableGeojsonLayerProps) => {
    const [features, setFeatures] = useState<SimpleFeature>({
      type: 'FeatureCollection',
      features: []
    });

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

  function getEditHandleColor(handle: {}): Color {
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

  const getDeckColorForFeature = useCallback(
    (index: number, bright: number, alpha: number): Color => {
      const length = FEATURE_COLORS.length;
      const color = FEATURE_COLORS[index % length].map((c) => c * bright * 255);

      return [...color, alpha * 255] as Color;
    },
    []
  );

  const onEdit = useCallback(
    ({ updatedData, editType, editContext }) => {
      let updatedSelectedFeatureIndexes = selectedFeatureIndexes;

      if (editType === 'addFeature' && mode !== DuplicateMode) {
        const { featureIndexes } = editContext;
        updatedSelectedFeatureIndexes = [...selectedFeatureIndexes, ...featureIndexes];
      }

      setFeatures(updatedData);
      setSelectedFeatureIndexes(updatedSelectedFeatureIndexes);
    },
    [selectedFeatureIndexes, mode]
  );

  const getFillColor = useCallback(
    (feature: SimpleFeature, isSelected: boolean) => {
      const index = features.features.indexOf(feature);
      return isSelected
        ? getDeckColorForFeature(index, 1.0, 0.5)
        : getDeckColorForFeature(index, 0.5, 0.5);
    },
    [features.features, getDeckColorForFeature]
  );

  const getLineColor = useCallback(
    (feature: SimpleFeature, isSelected: boolean) => {
      const index = features.features.indexOf(feature);
      return isSelected
        ? getDeckColorForFeature(index, 1.0, 1.0)
        : getDeckColorForFeature(index, 0.5, 1.0);
    },
    [features.features, getDeckColorForFeature]
  );

  const currentViewport: Record<string, number> = {
    ...viewport,
    height: window.innerHeight,
    width: window.innerWidth
  };

  let currentModeConfig = undefined;

  if (mode === ModifyMode) {
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
  }

  // @ts-expect-error TODO
  const editableGeoJsonLayer = new EditableGeoJsonLayer({
    id: 'geojson',
    data: features,
    selectedFeatureIndexes,
    mode,
    modeConfig: currentModeConfig,
    autoHighlight: false,
    onEdit,
    editHandleType: 'point',
    lineWidthMinPixels: 2,
    pointRadiusMinPixels: 5,
    getLineDashArray: () => [0, 0],
    getFillColor,
    getLineColor,
    getEditHandlePointColor: getEditHandleColor,
    editHandlePointRadiusScale: 2,
    getTentativeLineDashArray: () => [7, 4],
    getTentativeLineColor: () => [0x8f, 0x8f, 0x8f, 0xff],
    _subLayerProps: {
      tooltips: {
        getColor: [255, 255, 255, 255]
      }
    },
    parameters: {
      depthTest: true,
      depthMask: false,
      blend: true,
      blendEquation: GL.FUNC_ADD,
      blendFunc: [GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA]
    }
  });

  return { features, editableGeoJsonLayer };
}
