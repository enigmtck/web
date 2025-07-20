import { writable } from 'svelte/store';
export const parentArticleStore = writable<any>(null);

export { replyCount, TimelineDispatch };

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

export type ComposeDispatch = {
	replyToNote: DisplayNote;
	replyToActor: UserProfile | UserProfileTerse;
	openAside: boolean;
	parentArticle?: any;
};

interface TimelineDispatch {
	activity: Activity
}

class TimelineDispatch {}