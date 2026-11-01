import test from 'node:test';
import assert from 'node:assert/strict';
import mammoth from 'mammoth';
import JSZip from 'jszip';
import { parseDocxVersEpisode } from '../../resources/js/docx-import.js';

test('the original Word circuit imports dialogue, choices, effects and episode end', async () => {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    const paragraphs = ['LIAM : Bonjour', '- Oui (liam+5)', '- Non (liam-5)', 'LIAM : À bientôt', '[fin]'];
    zip.file('word/document.xml', '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paragraphs.map(text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`).join('') + '</w:body></w:document>');
    const arrayBuffer = await zip.generateAsync({ type: 'arraybuffer' });
    const extract = mammoth.extractRawText;
    // Mammoth's Node entry uses buffer; Vite selects its arrayBuffer browser entry.
    mammoth.extractRawText = ({ arrayBuffer }) => extract({ buffer: Buffer.from(arrayBuffer) });
    try {
        const { episode, avertissements } = await parseDocxVersEpisode(arrayBuffer, 'test', 'Test', new Set(['liam']));
        const nodes = Object.values(episode.nodes);
        const choice = nodes.find(node => node.type === 'choice');
        assert.equal(choice.options.length, 2);
        assert.equal(choice.options[0].effects.liam.amour, 5);
        assert.equal(choice.options[1].effects.liam.amour, -5);
        assert.ok(nodes.some(node => node.type === 'end'));
        assert.ok(nodes.some(node => node.speaker === 'liam' && node.text === 'Bonjour'));
        assert.deepEqual(avertissements, []);
    } finally {
        mammoth.extractRawText = extract;
    }
});
