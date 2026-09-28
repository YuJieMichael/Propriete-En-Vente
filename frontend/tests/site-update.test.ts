// @vitest-environment jsdom
import {expect,it} from 'vitest';
import {entryScript} from '../src/site-update';
it('recognizes the actual versioned entry script and ignores unrelated scripts',()=>{
 expect(entryScript('<script src="/analytics.js"></script><script type="module" src="./assets/index-new123.js"></script>','https://proprieteenvente.ca/')).toBe('https://proprieteenvente.ca/assets/index-new123.js');
});
it('does not treat error pages, development entries or off-site modules as updates',()=>{
 for(const html of ['<h1>Unavailable</h1>','<script type="module" src="/src/main.tsx"></script>','<script type="module" src="https://other.test/assets/index-abc.js"></script>'])expect(entryScript(html,'https://proprieteenvente.ca/')).toBeNull();
});
