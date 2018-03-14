import { expect }              from 'chai';
import 'mocha';
import { DeepModelDefinition } from './definition';

describe('DeepModelDefinition', function () {
    const kModuleId = 'MODULE';
    const kSubId = 'SUB_ID';
    const kModelDescName = 'TEST_AREA';
    const kModelDesc = {};
    const modelDef = new DeepModelDefinition(kModuleId, kSubId, kModelDescName, kModelDesc);
    modelDef.activate();
    it('should properly return all set attributes', function () {
        expect(modelDef.rootDescription).to.equal(kModelDesc);
        expect(modelDef.ident).to.equal('MODULE_SUB_ID');
        expect(modelDef.moduleIdent).to.equal('MODULE');
        expect(modelDef.label).to.equal(kModelDescName);
    });
});