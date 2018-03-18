import { Model } from '../model';
import {
    ModelPatch,
    ModelPatchUpdate
}                from './patch';
import {
    EModelPatchMergeDecision,
    ModelPatchMerge,
    ModelPatchMergeConflict
}                from './patchMerge';
import clone = require('clone');

export class ModelBranch {

    private _currentModel: Model;
    private _initialModel: Model;
    private _onCurrentChange: ((nextModel: Model) => void) | null = null;

    public static simplePatch(model: Model, cb: () => void): ModelPatchUpdate {
        const branch = new ModelBranch(model, true);
        cb();
        return branch.getPatch();
    }

    constructor(model?: Model, keepReference: boolean = false) {
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

    public getCurrent(): Model {
        return this._currentModel;
    }

    public mergeWith(nextModel: Model,
                     onConflicts: (conflicts: ModelPatchMergeConflict[]) =>
                         Promise<EModelPatchMergeDecision[]>): Promise<boolean | null> /* conflicts */ {
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
            const patchRemote = new ModelPatch(this._initialModel, nextModel);
            const patchLocal = new ModelPatch(this._initialModel, this._currentModel);

            const patchMerge = new ModelPatchMerge(patchLocal.getUpdates(),
                                                       patchRemote.getUpdates());

            let hadConflicts = false;
            return patchMerge
                .runAndResolveByCb((conflicts: ModelPatchMergeConflict[]) => {
                    hadConflicts = true;
                    return onConflicts(conflicts);
                })
                .then((mergedUpdate: ModelPatchUpdate) => {

                    this._initialModel = nextModel.getClone();

                    const newModel = Model.fromTransferData(
                        Object.assign(
                            clone(nextModel.dataForTransfer),
                            {
                                payload: this._initialModel.payload
                            }),
                        nextModel.modelDefinition);

                    ModelPatch.applyUpdate(mergedUpdate, newModel);
                    this._setCurrent(newModel);
                    return hadConflicts;
                });
        }
    }

    public getPatch(): ModelPatchUpdate {
        return new ModelPatch(this._initialModel, this._currentModel).getUpdates();
    }

    public reset() {
        this._setCurrent(this._currentModel.getClone(this._initialModel));
    }

    public onCurrentChange(cb: ((nextCurrent: Model) => void) | null) {
        this._onCurrentChange = cb;
    }

    protected _setCurrent(model: Model) {
        this._currentModel = model;
        model.immutable((nextModel) => {
            this._setCurrent(nextModel);
        });
        if (this._onCurrentChange) {
            this._onCurrentChange(this._currentModel);
        }
    }
}
