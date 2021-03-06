import {
    ModelDefinition,
    ModelFieldWithMetadata
}                                 from '../model/definition/definition';
import {
    DescField,
    EFieldType
}                                 from '../model/definition/description';
import { DescFieldSubModelArray } from '../model/definition/fieldSubModelArray';
import { ModelFPtr }              from '../model/fPtr';
import { Model }                  from '../model/model';

export enum EModelPatchArrayType {
    ePrimitive,
    eSubModel
}

export interface ModelPatchOnArrayIdWithPosition {
    position: number;
    idOrValue: any;
}

export interface ModelPatchOnArray {
    dataType: EModelPatchArrayType;
    idsAndPositions: ModelPatchOnArrayIdWithPosition[];
}

export interface ModelPatchUpdate {
    $set: Record<string, any>;
    $push: Record<string, ModelPatchOnArray>;
    $pull: Record<string, ModelPatchOnArray>;
}

const kFieldJoin = '.';

export class ModelPatch {

    private _updates: ModelPatchUpdate = {
        $set: {},
        $push: {},
        $pull: {}
    };

    public static resolveIndicesString(indicesString: string, rootModelDef: ModelDefinition): {
        field: DescField<any>,
        fieldPath: DescField<any>[],
        keyPath: string[],
    } {
        const indexArr = indicesString.split('.').map(index => parseInt(index, 10));
        const keyPath: string[] = [];
        const fieldPath: DescField<any>[] = [];

        let modelDefinition = rootModelDef;
        const fields = modelDefinition.fields;
        let fieldWithMetadata: ModelFieldWithMetadata = fields[0];

        for (let i = 0; i < indexArr.length; i += 2) {
            fieldWithMetadata = fields[indexArr[i]];
            fieldPath.push(fieldWithMetadata.field);
            keyPath.push(fieldWithMetadata.segmentKey,
                         fieldWithMetadata.key);
            if (i < (indexArr.length - 2)) {
                keyPath.push(indexArr[i + 1].toString(10));
                if (!(fieldWithMetadata instanceof DescFieldSubModelArray)) {
                    throw new Error(`Wrong field-type for sub-index, expected DescFSubModelArr`);
                }
                modelDefinition = fieldWithMetadata.subDefinition;
            }
        }

        return {
            field: fieldWithMetadata.field,
            fieldPath,
            keyPath: keyPath
        };
    }

    public static applyUpdate(updates: ModelPatchUpdate, model: Model): void {

        for (const indexKeys in updates.$set) {
            if (updates.$set.hasOwnProperty(indexKeys)) {
                ModelPatch.getDeepFPtr(indexKeys, model)
                          .set(updates.$set[indexKeys]);
            }
        }

        for (const indexKeys in updates.$push) {
            if (updates.$push.hasOwnProperty(indexKeys)) {
                const arrayOperation = updates.$push[indexKeys];
                ModelPatch.getDeepFPtr(indexKeys, model)
                          .get()
                          .push(...arrayOperation.idsAndPositions.map(idAndData => idAndData.idOrValue));
            }
        }

        for (const indexKeys in updates.$pull) {
            if (updates.$pull.hasOwnProperty(indexKeys)) {

                const arrayOperation = updates.$pull[indexKeys],
                      fPtr           = ModelPatch.getDeepFPtr(indexKeys, model);

                if (arrayOperation.dataType === EModelPatchArrayType.ePrimitive) {
                    fPtr.set(fPtr.get().filter(
                        (val: any) => !arrayOperation.idsAndPositions
                                                     .some(idAndPos => idAndPos.idOrValue === val)));
                } else {
                    fPtr.set(fPtr.get().filter(
                        (val: any[]) => !arrayOperation.idsAndPositions
                                                       .some(idAndPos => idAndPos.idOrValue === val[0])));
                }
            }
        }
    }

    private static getDeepFPtr(indicesString: string,
                               model: Model): ModelFPtr<any> {

        const indexArr = indicesString.split('.').map(index => parseInt(index, 10));

        let modelDefinition = model.modelDefinition;
        let fieldMeta: ModelFieldWithMetadata = modelDefinition.fields[0];

        let currModel: Model = model;

        for (let i = 0; i < indexArr.length; i += 2) {
            fieldMeta = modelDefinition.fields[indexArr[i]];
            if (i < (indexArr.length - 2)) {
                if (!(fieldMeta instanceof DescFieldSubModelArray)) {
                    throw new Error(`Wrong field-type for sub-index, expected DescFSubModelArr`);
                }
                modelDefinition = fieldMeta.subDefinition;
                currModel = currModel.fPtrSubModel(fieldMeta).getChildModels()[indexArr[i + 1]];
            }
        }

        return currModel.fPtr(fieldMeta.field);
    }

    private static _addToUpdate<T>(action: Record<string, T>, fieldPath: number[], to: T) {
        const path = fieldPath.join(kFieldJoin);
        if (action[path]) {
            throw new Error(`${JSON.stringify(action)} already defined `
                + `on ${path} with ${action[path]} (should set: ${to})`);
        }
        action[path] = to;
    }

    constructor(oldObj: Model, newObj: Model) {
        this._addObjectPatch(
            [],
            oldObj.payload.slice(),
            newObj.payload.slice(),
            newObj.modelDefinition);
    }

    public getUpdates(): ModelPatchUpdate {
        return this._updates;
    }

    private _set(fieldPath: number[], value: any): void {
        ModelPatch._addToUpdate(this._updates.$set, fieldPath, value);
    }

    private _pushPull(fieldPath: number[],
                      valPush: ModelPatchOnArrayIdWithPosition[],
                      valPull: ModelPatchOnArrayIdWithPosition[],
                      type: EModelPatchArrayType): void {
        if (valPush.length !== 0) {
            ModelPatch._addToUpdate(this._updates.$push, fieldPath, {
                dataType: type,
                idsAndPositions: valPush
            });
        }
        if (valPull.length !== 0) {
            ModelPatch._addToUpdate(this._updates.$pull, fieldPath, {
                dataType: type,
                idsAndPositions: valPull
            });
        }
    }

    private _addObjectPatch(prevFieldPath: number[], oldObj: any[], newObj: any[], modelDef: ModelDefinition) {

        if (oldObj.length !== newObj.length) {
            throw new Error(`objects must have same size`);
        }

        for (let i = 0; i < oldObj.length; i++) {

            const oldVal: any[] = oldObj[i],
                  newVal: any[] = newObj[i],
                  fieldMeta     = modelDef.fields[i],
                  fieldPath     = [...prevFieldPath, i];

            if (fieldMeta.field.fieldType === EFieldType.eSubModel) {

                const
                    newIds = newVal.map(el => el[0]),
                    oldIds = oldVal.map(el => el[0]);

                const
                    pushVals: ModelPatchOnArrayIdWithPosition[] = [],
                    pullVals: ModelPatchOnArrayIdWithPosition[] = [];

                for (let j = 0; j < oldVal.length; j++) {
                    const oldId = oldVal[j][0];
                    const newIndex = newIds.indexOf(oldId);
                    if (newIndex < 0) {
                        pullVals.push({
                                          position: j,
                                          idOrValue: oldVal[j][0]
                                      });
                    } else {
                        this._addObjectPatch([
                                                 ...fieldPath,
                                                 j
                                             ],
                                             oldVal[j],
                                             newVal[newIndex],
                                             (fieldMeta.field as DescFieldSubModelArray)
                                                 .subDefinition);
                    }
                }
                for (let j = 0; j < newVal.length; j++) {
                    const newId = newVal[j][0];
                    const oldIndex = oldIds.indexOf(newId);
                    if (oldIndex < 0) {
                        pushVals.push({
                                          position: j,
                                          idOrValue: newVal[j]
                                      });
                    }
                }
                this._pushPull(fieldPath,
                               pushVals,
                               pullVals,
                               EModelPatchArrayType.eSubModel);
            } else if (fieldMeta.field.isArray) {
                const valDataMapFn = (val: any, index: number): ModelPatchOnArrayIdWithPosition => {
                    return {
                        position: index,
                        idOrValue: val
                    };
                };
                const newValDataArr: ModelPatchOnArrayIdWithPosition[] = newVal.map(valDataMapFn);
                const oldValDataArr: ModelPatchOnArrayIdWithPosition[] = oldVal.map(valDataMapFn);

                this._pushPull(fieldPath,
                               newValDataArr
                                   .filter(newValData =>     // push
                                               !oldValDataArr
                                                   .some(oldValData =>
                                                             oldValData.idOrValue
                                                             === newValData.idOrValue)),
                               oldValDataArr
                                   .filter(oldValData =>     // pull
                                               !newValDataArr
                                                   .some(newValData =>
                                                             newValData.idOrValue
                                                             === oldValData.idOrValue)),
                               EModelPatchArrayType.ePrimitive);
            } else {
                if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
                    this._set(fieldPath, newVal);
                }
            }
        }
    }
}
