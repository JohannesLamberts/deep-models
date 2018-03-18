import * as clone     from 'clone';
import { FnArraySet } from '../_util/arraySet';
import {
    EModelPatchArrayType,
    ModelPatchOnArray,
    ModelPatchOnArrayIdWithPosition,
    ModelPatchUpdate
}                     from './patch';

export interface ModelPatchMergeConflictOption {
    description?: string;
    updates: Partial<ModelPatchUpdate>;
}

export enum EModelPatchMergeDecision {
    eNone   = -1,
    eLocal  = 0,
    eRemote = 1,
    eAuto   = 2
}

export interface ModelPatchMergeConflict {
    autoDecision: EModelPatchMergeDecision;
    local: ModelPatchMergeConflictOption;
    remote: ModelPatchMergeConflictOption;
}

const objEmpty = (obj: any) => !obj || JSON.stringify(obj) === '{}';

// remote pull OR local set/push in child   // also remove local pull in child if local accepted
// remote push OR local pull in parent
// remote set  OR local pull in parent / setting same field
// merge push/pull primitive

export class ModelPatchMerge {

    private _toLocalPatch: ModelPatchUpdate;
    private _fromRemotePatch: ModelPatchUpdate;

    private static _getSetConflicts(localPatch: ModelPatchUpdate,
                                    remotePatch: ModelPatchUpdate): ModelPatchMergeConflict[] {

        const
            conflicts: ModelPatchMergeConflict[] = [],
            localKeys                            = Object.keys(localPatch.$set),
            remoteKeys                           = Object.keys(remotePatch.$set);

        const conflictKeys = FnArraySet.intersection(localKeys, remoteKeys);

        for (let i = 0; i < conflictKeys.length; i++) {
            const key = conflictKeys[i];
            // check if both changed to the same value
            if (localPatch.$set[key] === remotePatch.$set[key]) {
                // remove one
                delete localPatch.$set[key];
            } else {
                const localSet: Record<string, any>  = {},
                      remoteSet: Record<string, any> = {};
                localSet[key] = localPatch.$set[key];
                remoteSet[key] = remotePatch.$set[key];
                conflicts.push({
                                   autoDecision: EModelPatchMergeDecision.eLocal,
                                   local: {
                                       updates: {
                                           $set: localSet
                                       }
                                   },
                                   remote: {
                                       updates: {
                                           $set: remoteSet
                                       }
                                   }
                               });
                // steal both
                delete localPatch.$set[key];
                delete remotePatch.$set[key];
            }
        }

        return conflicts;
    }

    private static _getPullConflicts(pullPatch: ModelPatchUpdate,
                                     otherPatch: ModelPatchUpdate,
                                     pullIsLocal: boolean): ModelPatchMergeConflict[] {
        const conflicts: ModelPatchMergeConflict[] = [];
        for (const indexKeys in pullPatch.$pull) {
            if (!pullPatch.$pull.hasOwnProperty(indexKeys)) {
                continue;
            }
            const item = pullPatch.$pull[indexKeys];
            if (item.dataType !== EModelPatchArrayType.eSubModel) {
                continue;
            }
            item.idsAndPositions.forEach((pullEl: ModelPatchOnArrayIdWithPosition) => {
                const conflictPath = `${indexKeys}.${pullEl.position}.`;
                const otherUpdateOption: ModelPatchMergeConflictOption = {
                    updates: {
                        $set: ModelPatchMerge._stealKeyMatches(otherPatch.$set, conflictPath),
                        $push: ModelPatchMerge._stealKeyMatches(otherPatch.$push, conflictPath),
                        $pull: ModelPatchMerge._stealKeyMatches(otherPatch.$pull, conflictPath)
                    }
                };

                if (objEmpty(otherUpdateOption.updates.$set)
                    && objEmpty(otherUpdateOption.updates.$pull)
                    && objEmpty(otherUpdateOption.updates.$push)) {
                    return;
                }

                const pull: Record<string, any> = {};
                pull[indexKeys] = pullPatch.$pull[indexKeys];
                delete pullPatch.$pull[indexKeys];
                const pullUpdateOption: ModelPatchMergeConflictOption = {
                    updates: {
                        $pull: pull
                    }
                };
                if (pullIsLocal) {
                    conflicts.push(
                        {
                            autoDecision: EModelPatchMergeDecision.eLocal,
                            local: pullUpdateOption,
                            remote: otherUpdateOption
                        });
                } else {
                    conflicts.push(
                        {
                            autoDecision: EModelPatchMergeDecision.eRemote,
                            local: otherUpdateOption,
                            remote: pullUpdateOption
                        });
                }
            });
        }
        return conflicts;
    }

    private static _stealKeyMatches(updates: Record<string, any>, pathStartsWith: string = ''): Record<string, any> {
        const returnDict: Record<string, any> = {};
        for (const key in updates) {
            if (!updates.hasOwnProperty(key)) {
                continue;
            }
            if (key.indexOf(pathStartsWith) === 0) {
                returnDict[key] = updates[key];
                delete updates[key];
            }
        }
        return returnDict;
    }

    constructor(toLocalPatch: ModelPatchUpdate,
                fromRemotePatch: ModelPatchUpdate) {

        this._toLocalPatch = clone(toLocalPatch);
        this._fromRemotePatch = clone(fromRemotePatch);

    }

    public runAndResolveWith(decision: EModelPatchMergeDecision
                                 = EModelPatchMergeDecision.eAuto): Promise<ModelPatchUpdate> {
        return this.runAndResolveByCb(conflicts =>
                                          Promise.resolve(conflicts.map(valDoesntMatter => decision)));
    }

    public runAndResolveByCb(onConflicts: (conflicts: ModelPatchMergeConflict[])
        => Promise<EModelPatchMergeDecision[]>): Promise<ModelPatchUpdate> {

        // 1. conflicts by remote pull subModel
        // 2. conflicts by local  pull subModel
        // 3. merge push/pull on primitives not already covered
        // 4. conflicts by set on same field

        const conflicts: ModelPatchMergeConflict[] = [];

        conflicts.push(
            ...ModelPatchMerge._getPullConflicts(this._fromRemotePatch, this._toLocalPatch, false),
            ...ModelPatchMerge._getPullConflicts(this._toLocalPatch, this._fromRemotePatch, true),
            ...ModelPatchMerge._getSetConflicts(this._toLocalPatch, this._fromRemotePatch));

        let conflictsPromise = Promise.resolve();

        const resultUpdate: ModelPatchUpdate = {
            $set: {},
            $push: {},
            $pull: {}
        };

        if (conflicts.length !== 0) {
            conflictsPromise = onConflicts(conflicts)
                .then((decisions: EModelPatchMergeDecision[]) => {
                    conflicts.forEach((conflict: ModelPatchMergeConflict, index) => {
                        let decision = decisions[index];
                        if (decision === EModelPatchMergeDecision.eAuto) {
                            decision = conflict.autoDecision;
                        }
                        let decisionUpdate: Partial<ModelPatchUpdate>;
                        switch (decision) {
                            case EModelPatchMergeDecision.eLocal:
                                decisionUpdate = conflict.local.updates;
                                break;
                            case EModelPatchMergeDecision.eRemote:
                                decisionUpdate = conflict.remote.updates;
                                break;
                            default:
                                throw new Error(`Decision must be eLocal or eRemote, is ${decision}`);
                        }
                        Object.assign(resultUpdate.$set, decisionUpdate.$set);

                        ['$pull', '$push'].forEach((action: '$pull' | '$push') => {
                            const decisionUpdateForAction = decisionUpdate[action];
                            if (decisionUpdateForAction) {
                                for (const key of Object.keys(decisionUpdateForAction)) {
                                    const update = decisionUpdateForAction[key];
                                    if (resultUpdate[action][key]) {
                                        resultUpdate[action][key].idsAndPositions.push(...update.idsAndPositions);
                                    } else {
                                        resultUpdate[action][key] = update;
                                    }
                                }
                            }
                        });
                    });
                });
        }

        // merge non-conflicts
        return conflictsPromise
            .then(() => {

                const primitive: string[] = [];

                [this._fromRemotePatch, this._toLocalPatch]
                    .forEach((update: ModelPatchUpdate) => {
                        for (const indexKeys of Object.keys(update.$set)) {
                            resultUpdate.$set[indexKeys] = update.$set[indexKeys];
                            delete update.$set[indexKeys];
                        }
                        ['$push', '$pull']
                            .forEach((key: '$push' | '$pull') => {
                                for (const indexKeys of Object.keys(this._fromRemotePatch[key])) {
                                    const val = this._fromRemotePatch[key][indexKeys];
                                    if (val.dataType === EModelPatchArrayType.ePrimitive) {
                                        primitive.push(indexKeys);
                                    } else {
                                        resultUpdate[key][indexKeys] = val;
                                        delete update[key][indexKeys];
                                    }
                                }
                            });
                    });

                primitive.forEach(indexKeys => {
                    const unionAndMapToArrayUpdate =
                              (local: Record<string, ModelPatchOnArray>,
                               remote: Record<string, ModelPatchOnArray>): ModelPatchOnArray => {
                                  const localVals = local[indexKeys]
                                      ? local[indexKeys].idsAndPositions
                                      : [];
                                  const remoteVals = remote[indexKeys]
                                      ? remote[indexKeys].idsAndPositions
                                      : [];

                                  delete local[indexKeys];
                                  delete remote[indexKeys];

                                  return {
                                      dataType: EModelPatchArrayType.ePrimitive,
                                      idsAndPositions:
                                          localVals.concat(
                                              remoteVals.filter(
                                                  remoteVal =>
                                                      !localVals.some(
                                                          localVal =>
                                                              localVal.idOrValue
                                                              === remoteVal.position)))
                                  };
                              };

                    const
                        pullResult = unionAndMapToArrayUpdate(
                            this._toLocalPatch.$pull,
                            this._fromRemotePatch.$pull),

                        pushResult = unionAndMapToArrayUpdate(
                            this._toLocalPatch.$push,
                            this._fromRemotePatch.$push);

                    if (pullResult.idsAndPositions.length !== 0) {
                        resultUpdate.$pull[indexKeys] = pullResult;
                    }
                    if (pushResult.idsAndPositions.length !== 0) {
                        resultUpdate.$push[indexKeys] = pushResult;
                    }
                });

                return resultUpdate;
            });
    }
}
