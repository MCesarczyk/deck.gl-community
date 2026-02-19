import * as React from 'react';
import { useCallback } from 'react';
import {Toolbox, ToolboxTitle, ToolboxRow, ToolboxButton} from './toolbox';
import { DrawRectangleMode, ModifyMode, SnappableMode, TranslateMode, ViewMode } from '@deck.gl-community/editable-layers';

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

interface UseToolboxProps {
  features: any;
  mode: any;
  setMode: (mode: any) => void;
  setSelectionTool: (tool: string | undefined) => void;
}

export const useToolbox = ({ features, mode, setMode, setSelectionTool }: UseToolboxProps) => {
    const renderToolBox = useCallback(() => {
      return (
        <Toolbox>
          {ALL_MODES.map((category) => (
            <ToolboxRow key={category.category}>
              <ToolboxTitle>{category.category} Modes</ToolboxTitle>
              {category.modes.map(({mode: modeOption, label}) => (
                <ToolboxButton
                  key={label}
                  // @ts-expect-error types not updated
                  selected={mode === modeOption}
                  onClick={() => {
                    setMode(() => modeOption);
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
    }, [mode, features]);

  return {
    renderToolBox
  }
}
