export { replyCount };

import type { DisplayNote } from '../../../common';

function replyCount(note: DisplayNote): number {
    let count = note.replies.size;

    if (note.replies.size > 0) {	
        note.replies.forEach((x) => {
            count += replyCount(x);
        })
    } 

    return count;
}