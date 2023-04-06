export { attachmentsDisplay, replyCount };

import type { Note, Attachment, DisplayNote } from '../../../common';

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

function replyCount(note: DisplayNote): number {
    let count = note.replies.size;

    if (note.replies.size > 0) {	
        note.replies.forEach((x) => {
            count += replyCount(x);
        })
    } 

    return count;
}