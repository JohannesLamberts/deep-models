import { expect }        from 'chai';
import 'mocha';
import {
    DeepModelDefinition,
    kDeepModelPayloadRootSegment
}                        from './definition/definition';
import {
    DescField,
    EFieldType
}                        from './definition/description';
import { DeepModelFPtr } from './fPtr';
import { DeepModel }     from './model';

const modelDef = new DeepModelDefinition(
    'MODULE',
    'IDENT',
    'TEST_OBJECT',
    {
        string: new DescField('FIELD_NAME_STRING', EFieldType.eString)
    });

modelDef.activate();

const desc = modelDef.desc;

const DeepModelInitial = DeepModel.fromDataArray(
    modelDef.documentToArr({ [kDeepModelPayloadRootSegment]: { string: 'string' } }),
    modelDef);

describe('DeepModelFPtr', function () {

    const model = DeepModelInitial.getClone();
    const fPtr = new DeepModelFPtr(model, desc.string);

    it('should return the field value', function () {
        expect(fPtr.get()).to.equal('string');
    });

    it('should set the correct field value', function () {
        fPtr.set('string_set');
        expect(fPtr.get()).to.equal('string_set');
    });
});