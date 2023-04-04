export { attachmentsDisplay };

import type { Note, Attachment } from '../../../common';

function attachmentsDisplay(note: Note): string {
    let attachments = '';
    if (note.attachment && note.attachment.length > 0) {
        note.attachment.forEach((x: Attachment) => {
            if (x.type == 'Document' && /^(?:image)\/.+$/.test(String(x.mediaType))) {
                attachments += `<div><img src="${x.url}" width="${x.width}" height="${x.height}"/></div>`;
            } else if (x.type == 'Document' && /^(?:video)\/.+$/.test(String(x.mediaType))) {
                attachments += `<div><video width="${x.width}" height="${x.height}" controls><source src="${x.url}" type="${x.mediaType}"></video></div>`;
            }
        });
    }

    return attachments;
}