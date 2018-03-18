import { Model }       from '../model/model';
import { ModelBranch } from './branch';
import {
    EModelPatchMergeDecision,
    ModelPatchMergeConflict
}                      from './patchMerge';

export class ModelSelectionBranch {

    private _objBranches: ModelBranch[] = [];

    constructor(private _cb: (newVal: Model[]) => void) {
    }

    public getBranches(): ModelBranch[] {
        return this._objBranches;
    }

    public mergeWith(newVals: Model[],
                     onConflicts: (model: Model, conflicts: ModelPatchMergeConflict[]) =>
                         Promise<EModelPatchMergeDecision[]>): Promise<boolean> /*conflicts*/ {

        const mergePromises: Promise<boolean | null>[] = [];

        let hasConflicts = false;
        const count = this._objBranches.length;
        const nextLevelBranches: ModelBranch[] = [];

        newVals.forEach((newVal: Model) => {

            let found = false;

            for (let i = 0; i < count; i++) {
                const el = this._objBranches[i];
                if (el.getCurrent().id === newVal.id) {
                    mergePromises.push(
                        el.mergeWith(newVal,
                                     (conflicts: ModelPatchMergeConflict[]) => {
                                         hasConflicts = true;
                                         return onConflicts(el.getCurrent(), conflicts);
                                     }));
                    nextLevelBranches.push(el);
                    found = true;
                    break;
                }
            }
            if (!found) {
                nextLevelBranches.push(new ModelBranch(newVal));
            }
        });

        return Promise.all(mergePromises)
                      .then(() => {
                          this._objBranches = nextLevelBranches;
                          this._objBranches.forEach(branch => branch.onCurrentChange(() => {
                              this._refresh();
                          }));
                          this._refresh();
                          return hasConflicts;
                      });
    }

    private _refresh() {
        this._cb(this._objBranches.map(el => el.getCurrent()));
    }
}
