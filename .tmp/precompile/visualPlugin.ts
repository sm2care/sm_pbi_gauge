import { SM2ExecutiveGauge } from "../../src/visual";
import powerbiVisualsApi from "powerbi-visuals-api";
import IVisualPlugin = powerbiVisualsApi.visuals.plugins.IVisualPlugin;
import VisualConstructorOptions = powerbiVisualsApi.extensibility.visual.VisualConstructorOptions;
import DialogConstructorOptions = powerbiVisualsApi.extensibility.visual.DialogConstructorOptions;
var powerbiKey: any = "powerbi";
var powerbi: any = window[powerbiKey];
var SM2ExecutiveGauge9F3C2A1B4D5E47A8B0C1D2E3F4A5B6C7: IVisualPlugin = {
    name: 'SM2ExecutiveGauge9F3C2A1B4D5E47A8B0C1D2E3F4A5B6C7',
    displayName: 'SM2 Executive Gauge',
    class: 'SM2ExecutiveGauge',
    apiVersion: '5.11.0',
    create: (options?: VisualConstructorOptions) => {
        if (SM2ExecutiveGauge) {
            return new SM2ExecutiveGauge(options);
        }
        throw 'Visual instance not found';
    },
    createModalDialog: (dialogId: string, options: DialogConstructorOptions, initialState: object) => {
        const dialogRegistry = (<any>globalThis).dialogRegistry;
        if (dialogId in dialogRegistry) {
            new dialogRegistry[dialogId](options, initialState);
        }
    },
    custom: true
};
if (typeof powerbi !== "undefined") {
    powerbi.visuals = powerbi.visuals || {};
    powerbi.visuals.plugins = powerbi.visuals.plugins || {};
    powerbi.visuals.plugins["SM2ExecutiveGauge9F3C2A1B4D5E47A8B0C1D2E3F4A5B6C7"] = SM2ExecutiveGauge9F3C2A1B4D5E47A8B0C1D2E3F4A5B6C7;
}
export default SM2ExecutiveGauge9F3C2A1B4D5E47A8B0C1D2E3F4A5B6C7;