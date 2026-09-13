'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
test('isolated recovery restores linked metadata and original bytes and detects absent/corrupt objects',async()=>{const result=await require('../scripts/restore-drill').run();assert(result.caseAssociation&&result.missingObjectDetected&&result.corruptionDetected&&result.originalBytesRestored);assert.equal(result.productionBackupRestored,false);});
