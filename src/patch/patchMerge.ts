import * as clone     from 'clone';
import { FnArraySet } from '../_util/arraySet';
import {
    DeepModelPatchOnArray,
    DeepModelPatchOnArrayIdWithPosition,
    DeepModelPatchUpdate,
    EDeepModelPatchArrayType
}                     from './patch';

export interface DeepModelPatchMergeConflictOption {
    description?: string;
    updates: Partial<DeepModelPatchUpdate>;
}

export enum EDeepModelPatchMergeDecision {
    eNone   = -1,
    eLocal  = 0,
    eRemote = 1,
    eAuto   = 2
}

export interface DeepModelPatchMergeConflict {
    autoDecision: EDeepModelPatchMergeDecision;
    local: DeepModelPatchMergeConflictOption;
    remote: DeepModelPatchMergeConflictOption;
}

const objEmpty = (obj: any) => !obj || JSON.stringify(obj) === '{}';

// remote pull OR local set/push in child   // also remove local pull in child if local accepted
// remote push OR local pull in parent
// remote set  OR local pull in parent / setting same field
// merge push/pull primitive

export class DeepModelPatchMerge {

    private _toLocalPatch: DeepModelPatchUpdate;
    private _fromRemotePatch: DeepModelPatchUpdate;

    private static _getSetConflicts(localPatch: DeepModelPatchUpdate,
                                    remotePatch: DeepModelPatchUpdate): DeepModelPatchMergeConflict[] {

        const
            conflicts: DeepModelPatchMergeConflict[] = [],
            localKeys                                = Object.keys(localPatch.$set),
            remoteKeys                               = Object.keys(remotePatch.$set);

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
                                   autoDecision: EDeepModelPatchMergeDecision.eLocal,
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

    private static _getPullConflicts(pullPatch: DeepModelPatchUpdate,
                                     otherPatch: DeepModelPatchUpdate,
                                     pullIsLocal: boolean): DeepModelPatchMergeConflict[] {
        const conflicts: DeepModelPatchMergeConflict[] = [];
        for (const indexKeys in pullPatch.$pull) {
            if (!pullPatch.$pull.hasOwnProperty(indexKeys)) {
                continue;
            }
            const item = pullPatch.$pull[indexKeys];
            if (item.dataType !== EDeepModelPatchArrayType.eSubModel) {
                continue;
            }
            item.idsAndPositions.forEach((pullEl: DeepModelPatchOnArrayIdWithPosition) => {
                const conflictPath = `${indexKeys}.${pullEl.position}.`;
                const otherUpdateOption: DeepModelPatchMergeConflictOption = {
                    updates: {
                        $set: DeepModelPatchMerge._stealKeyMatches(otherPatch.$set, conflictPath),
                        $push: DeepModelPatchMerge._stealKeyMatches(otherPatch.$push, conflictPath),
                        $pull: DeepModelPatchMerge._stealKeyMatches(otherPatch.$pull, conflictPath)
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
                const pullUpdateOption: DeepModelPatchMergeConflictOption = {
                    updates: {
                        $pull: pull
                    }
                };
                if (pullIsLocal) {
                    conflicts.push(
                        {
                            autoDecision: EDeepModelPatchMergeDecision.eLocal,
                            local: pullUpdateOption,
                            remote: otherUpdateOption
                        });
                } else {
                    conflicts.push(
                        {
                            autoDecision: EDeepModelPatchMergeDecision.eRemote,
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

    constructor(toLocalPatch: DeepModelPatchUpdate,
                fromRemotePatch: DeepModelPatchUpdate) {

        this._toLocalPatch = clone(toLocalPatch);
        this._fromRemotePatch = clone(fromRemotePatch);

    }

    public runAndResolveWith(decision: EDeepModelPatchMergeDecision
                                 = EDeepModelPatchMergeDecision.eAuto): Promise<DeepModelPatchUpdate> {
        return this.runAndResolveByCb(conflicts =>
                                          Promise.resolve(conflicts.map(valDoesntMatter => decision)));
    }

    public runAndResolveByCb(onConflicts: (conflicts: DeepModelPatchMergeConflict[])
        => Promise<EDeepModelPatchMergeDecision[]>): Promise<DeepModelPatchUpdate> {

        // 1. conflicts by remote pull subModel
        // 2. conflicts by local  pull subModel
        // 3. merge push/pull on primitives not already covered
        // 4. conflicts by set on same field

        const conflicts: DeepModelPatchMergeConflict[] = [];

        conflicts.push(
            ...DeepModelPatchMerge._getPullConflicts(this._fromRemotePatch, this._toLocalPatch, false),
            ...DeepModelPatchMerge._getPullConflicts(this._toLocalPatch, this._fromRemotePatch, true),
            ...DeepModelPatchMerge._getSetConflicts(this._toLocalPatch, this._fromRemotePatch));

        let conflictsPromise = Promise.resolve();

        const resultUpdate: DeepModelPatchUpdate = {
            $set: {},
            $push: {},
            $pull: {}
        };

        if (conflicts.length !== 0) {
            conflictsPromise = onConflicts(conflicts)
                .then((decisions: EDeepModelPatchMergeDecision[]) => {
                    conflicts.forEach((conflict: DeepModelPatchMergeConflict, index) => {
                        let decision = decisions[index];
                        if (decision === EDeepModelPatchMergeDecision.eAuto) {
                            decision = conflict.autoDecision;
                        }
                        let decisionUpdate: Partial<DeepModelPatchUpdate>;
                        switch (decision) {
                            case EDeepModelPatchMergeDecision.eLocal:
                                decisionUpdate = conflict.local.updates;
                                break;
                            case EDeepModelPatchMergeDecision.eRemote:
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
                    .forEach((update: DeepModelPatchUpdate) => {
                        for (const indexKeys of Object.keys(update.$set)) {
                            resultUpdate.$set[indexKeys] = update.$set[indexKeys];
                            delete update.$set[indexKeys];
                        }
                        ['$push', '$pull']
                            .forEach((key: '$push' | '$pull') => {
                                for (const indexKeys of Object.keys(this._fromRemotePatch[key])) {
                                    const val = this._fromRemotePatch[key][indexKeys];
                                    if (val.dataType === EDeepModelPatchArrayType.ePrimitive) {
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
                              (local: Record<string, DeepModelPatchOnArray>,
                               remote: Record<string, DeepModelPatchOnArray>): DeepModelPatchOnArray => {
                                  const localVals = local[indexKeys]
                                      ? local[indexKeys].idsAndPositions
                                      : [];
                                  const remoteVals = remote[indexKeys]
                                      ? remote[indexKeys].idsAndPositions
                                      : [];

                                  delete local[indexKeys];
                                  delete remote[indexKeys];

                                  return {
                                      dataType: EDeepModelPatchArrayType.ePrimitive,
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
