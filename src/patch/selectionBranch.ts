import { DeepModel }       from '../model/model';
import { DeepModelBranch } from './branch';
import {
    DeepModelPatchMergeConflict,
    EDeepModelPatchMergeDecision
}                          from './patchMerge';

export class DeepModelSelectionBranch {

    private _objBranches: DeepModelBranch[] = [];

    constructor(private _cb: (newVal: DeepModel[]) => void) {
    }

    public getBranches(): DeepModelBranch[] {
        return this._objBranches;
    }

    public mergeWith(newVals: DeepModel[],
                     onConflicts: (model: DeepModel, conflicts: DeepModelPatchMergeConflict[]) =>
                         Promise<EDeepModelPatchMergeDecision[]>): Promise<boolean> /*conflicts*/ {

        const mergePromises: Promise<boolean | null>[] = [];

        let hasConflicts = false;
        const count = this._objBranches.length;
        const nextLevelBranches: DeepModelBranch[] = [];

        newVals.forEach((newVal: DeepModel) => {

            let found = false;

            for (let i = 0; i < count; i++) {
                const el = this._objBranches[i];
                if (el.getCurrent().id === newVal.id) {
                    mergePromises.push(
                        el.mergeWith(newVal,
                                     (conflicts: DeepModelPatchMergeConflict[]) => {
                                         hasConflicts = true;
                                         return onConflicts(el.getCurrent(), conflicts);
                                     }));
                    nextLevelBranches.push(el);
                    found = true;
                    break;
                }
            }
            if (!found) {
                nextLevelBranches.push(new DeepModelBranch(newVal));
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
