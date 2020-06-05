import TestRunner from './framework/testRunner';

import BasicHtmlTest from './endToEnd/basicHtmlTests';
import FragmentOnlyTests from './endToEnd/fragmentOnlyTests';
import FragmentSlotTests from './endToEnd/fragmentSlotTests';
import CliArgsTests from './unit/cliArgsTests';
import TestSetGroup from './framework/testSetGroup';
import PipelineCacheTests from './unit/pipelineCacheTests';
import UsageContextTests from './unit/usageContextTests';

// create test runner instance
const testRunner: TestRunner = new TestRunner();

// add test sets
testRunner.addTestSetGroups(
    // Unit tests first
    new TestSetGroup('unit', [
        new PipelineCacheTests(),
        new UsageContextTests(),
        new CliArgsTests()
    ]),

    // integration tests second
    new TestSetGroup('integration'),

    // end-to-end tests last
    new TestSetGroup('endToEnd', [
        new BasicHtmlTest(),
        new FragmentOnlyTests(),
        new FragmentSlotTests()
    ])
);

// Run tests
testRunner.runAllTests();