export { replyCount, ComposeDispatch };

import type { DisplayNote, Note, UserProfile, UserProfileTerse } from '../../../common';

function replyCount(note: DisplayNote): number {
	let count = note.replies.size;

	if (note.replies.size > 0) {
		note.replies.forEach((x) => {
			count += replyCount(x);
		});
	}

	return count;
}

interface ComposeDispatch {
	replyToActor: UserProfile | UserProfileTerse;
	replyToNote: Note;
	openAside: boolean;
}

class ComposeDispatch {}
