export { replyCount, ComposeDispatch, TimelineDispatch };

import type { Activity, DisplayNote, Note, UserProfile, UserProfileTerse } from '../../../common';

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
	replyToNote: DisplayNote;
	openAside: boolean;
}

class ComposeDispatch {}

interface TimelineDispatch {
	activity: Activity
}

class TimelineDispatch {}