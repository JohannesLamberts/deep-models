import { DeepModel } from '../model/model';
import {
    DeepModelPatch,
    DeepModelPatchUpdate
}                    from './model_patch';
import {
    DeepModelPatchMerge,
    DeepModelPatchMergeConflict,
    EDeepModelPatchMergeDecision
}                    from './model_patch_merge';
import clone = require('clone');

export class DeepModelBranch {

    private _currentModel: DeepModel;
    private _initialModel: DeepModel;

    private _onCurrentChange: ((nextModel: DeepModel) => void) | null = null;

    constructor(model?: DeepModel, keepReference: boolean = false) {
        if (keepReference) {
            if (!model) {
                throw new Error(`No object!`);
            }
            this._initialModel = model.getClone();
            this._setCurrent(model);
        } else {
            if (model) {
                this._initialModel = model.getClone();
                this._setCurrent(model.getClone());
            }
        }
    }

    public getCurrent(): DeepModel {
        return this._currentModel;
    }

    public mergeWith(nextModel: DeepModel,
                     onConflicts: (conflicts: DeepModelPatchMergeConflict[]) =>
                         Promise<EDeepModelPatchMergeDecision[]>): Promise<boolean | null> /* conflicts */ {
        if (!nextModel) {
            throw new Error(`New object may not be null`);
        }
        const isInitial = this._initialModel === null;
        if (isInitial) {
            this._initialModel = nextModel.getClone();
            this._setCurrent(nextModel.getClone());
            if (!isInitial) {
                return Promise.resolve(false);
            } else {
                return Promise.resolve(null);
            }
        } else {
            const patchRemote = new DeepModelPatch(this._initialModel, nextModel);
            const patchLocal = new DeepModelPatch(this._initialModel, this._currentModel);

            const patchMerge = new DeepModelPatchMerge(patchLocal.getUpdates(),
                                                       patchRemote.getUpdates());

            let hadConflicts = false;
            return patchMerge
                .runAndResolveByCb((conflicts: DeepModelPatchMergeConflict[]) => {
                    hadConflicts = true;
                    return onConflicts(conflicts);
                })
                .then((mergedUpdate: DeepModelPatchUpdate) => {

                    this._initialModel = nextModel.getClone();

                    const newModel = DeepModel.fromTransferData(
                        Object.assign(
                            clone(nextModel.dataForTransfer),
                            {
                                payload: this._initialModel.payload
                            }),
                        nextModel.modelDefinition);

                    DeepModelPatch.applyUpdate(mergedUpdate, newModel);
                    this._setCurrent(newModel);
                    return hadConflicts;
                });
        }
    }

    public getPatch(): DeepModelPatchUpdate {
        return new DeepModelPatch(this._initialModel, this._currentModel).getUpdates();
    }

    public reset() {
        this._setCurrent(this._currentModel.getClone(this._initialModel));
    }

    public onCurrentChange(cb: ((nextCurrent: DeepModel) => void) | null) {
        this._onCurrentChange = cb;
    }

    protected _setCurrent(model: DeepModel) {
        this._currentModel = model;
        model.immutable((nextModel) => {
            this._setCurrent(nextModel);
        });
        if (this._onCurrentChange) {
            this._onCurrentChange(this._currentModel);
        }
    }
}
