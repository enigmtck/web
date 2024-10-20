export type {
	UserProfile,
	UserProfileTerse,
	EnigmatickEvent,
	EnigmatickEventObject,
	Activity,
	Announce,
	Tag,
	Attachment,
	Metadata,
	Note,
	StreamConnect,
	AnnounceParams,
	Image,
	Instrument,
	OlmSessionResponse,
	Collection,
	QueueItem,
	VaultedMessage
};
export {
	insertEmojis,
	timeSince,
	compare,
	getWebFingerFromId,
	sleep,
	DisplayNote,
	extractUuid,
	extractMaxMin,
	cachedContent,
	domainMatch
};

interface DisplayNote {
	note: Note;
	actor: UserProfile | UserProfileTerse;
	published: string;
	created_at: string;
	replies: Map<string, DisplayNote>;
}

class DisplayNote {
	note: Note;
	actor: UserProfile | UserProfileTerse;
	published: string;
	created_at: string;
	replies: Map<string, DisplayNote>;

	constructor(profile: UserProfile | UserProfileTerse, note: Note, replies?: Map<string, DisplayNote>) {
		this.note = note;
		this.actor = profile;

		if (note.published) {
			this.published = String(note.published);
		} else if (note.ephemeralTimestamp) {
			this.published = note.ephemeralTimestamp;
		} else {
			this.published = new Date().toISOString();
		}

		if (note.ephemeralTimestamp) {
			this.created_at = note.ephemeralTimestamp;
		} else {
			this.created_at = new Date().toISOString();
		}

		this.replies = replies || new Map<string, DisplayNote>();
	}
}

interface Image {
	mediaType?: string;
	type: string;
	url: string;
}

interface AnnounceParams {
	url: string;
	name: string;
	others: string;
}

interface Capabilities {
	acceptsChatMessages?: boolean;
	enigmatickEncryption?: boolean;
}

interface UserProfileTerse {
	id: string;
	url: string;
	name?: string;
	preferredUsername: string;
	tag: Tag[];
	icon?: Image;
}

interface UserProfile {
	'@context': string;
	type: string;
	name?: string;
	summary?: string;
	id?: string;
	preferredUsername: string;
	inbox: string;
	outbox: string;
	followers: string;
	following: string;
	liked?: string;
	publicKey: object;
	featured?: string;
	featuredTags?: string;
	url?: string;
	manuallyApprovesFollowers?: boolean;
	published?: string;
	tag?: Tag[];
	attachment?: object;
	endpoints?: object;
	icon?: Image;
	image?: Image;
	capabilities?: Capabilities;
	ephemeralFollowing?: boolean;
	ephemeralLeaderApId?: string;
	ephemeralFollowActivityApId?: string;
	ephemeralSummaryMarkdown?: string;
	ephemeralLeaders?: string[] | UserProfile[];
	ephemeralFollowers?: string[] | UserProfile[];
}

interface EnigmatickEventObject {
	id: string;
}

interface EnigmatickEvent {
	'@context': string;
	type: string;
	id?: string;
	actor?: string | null;
	to?: string | null;
	cc?: string | null;
	object?: EnigmatickEventObject | string | null;
	attributedTo?: string | null;
	content?: string | null;
	published: string;
	inReplyTo?: string | null;
}

interface Announce {
	'@context': string;
	id: string;
	actor: string;
	cc: string[];
	to: string[];
	object: string;
	published: string;
	type: 'Announce';
}

interface Tag {
	type: 'Mention' | 'Emoji' | 'Hashtag';
	name: string;
	href?: string | null;
	id?: string;
	updated?: string;
	icon?: Image;
	value?: string | null;
}

interface Attachment {
	type: 'PropertyValue' | 'Document' | 'IdentityProof';
	name?: string | null;
	value?: string | null;
	hash?: string | null;
	mutationOf?: string | null;
	mediaType?: string | null;
	url?: string | null;
	blurhash?: string | null;
	width?: number | null;
	height?: number | null;
}

interface Metadata {
	twitterTitle?: string | null;
	description?: string | null;
	ogDescription?: string | null;
	ogTitle?: string | null;
	ogImage?: string | null;
	ogSiteName?: string | null;
	twitterImage?: string | null;
	ogUrl?: string | null;
	twitterDescription?: string | null;
	published?: string | null;
	twitterSite?: string | null;
	ogType?: string | null;
}

interface Note {
	'@context': string;
	type: 'Note';
	tag?: Tag[];
	id?: string;
	actor?: string | null;
	to?: string[];
	cc?: string[];
	url?: string;
	attributedTo: string;
	content?: string | null;
	replies?: object | null;
	published: string | null;
	inReplyTo?: string | null;
	attachment?: Attachment[];
	conversation: string | null;
	ephemeralAnnounces?: UserProfileTerse[] | null;
	ephemeralAnnounced?: string | null;
	ephemeralActors?: UserProfile[];
	ephemeralLiked?: string | null;
	ephemeralLikes?: UserProfileTerse[] | null;
	ephemeralTargeted?: boolean | null;
	ephemeralTimestamp?: string | null;
	ephemeralMetadata?: Metadata[] | null;
	ephemeralAttributedTo?: UserProfileTerse[] | null;
}

interface Activity {
	'@context': string;
	type: 'Create' | 'Announce';
	actor: string;
	to: string[];
	cc: string[];
	id: string;
	object: Note;
	published: string | null;
	ephemeralCreatedAt: string | null;
	ephemeralUpdatedAt: string | null;
}

interface StreamConnect {
	uuid: string;
}

interface OlmSessionResponse {
	session_pickle: string;
	uuid: string;
}

interface Instrument {
	type: 'IdentityKey' | 'SessionKey' | 'OlmSession';
	content: string;
	hash?: string;
	uuid?: string;
}

interface QueueItem {
	'@context'?: string | null;
	actor?: string;
	attributedTo?: string;
	id: string;
	tag?: object[];
	type: 'EncryptedNote' | 'EncryptedSession' | 'VaultNote' | 'Note' | 'Announce' | 'Create';
	to: string[] | string;
	published: string;
	content?: string;
	conversations?: string;
	instrument?: Instrument[] | Instrument;
	object?: Note | string;
}

interface Collection {
	'@context': string;
	type: 'Collection' | 'CollectionPage' | 'OrderedCollection' | 'OrderedCollectionPage';
	id: string;
	totalItems: number;
	items?: Activity[];
	orderedItems?: Activity[];
	prev?: string;
	next?: string;
	first?: string;
	last?: string;
}

interface VaultedMessage {
	message: string;
	published: string;
	attributedTo?: string;
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWebFingerFromId(actor: UserProfile | UserProfileTerse): string {
	const re = /^https:\/\/([a-zA-Z0-9\-.]+?)\/[A-Za-z0-9/\-._]+$/;

	if (actor.id) {
		const match = actor.id.match(re);

		if (match) {
			return `@${actor.preferredUsername}@${match[1]}`;
		}
	}

	return String(actor.url);
}

function insertEmojis(
	wasm: typeof import('enigmatick_wasm') | null,
	text: string,
	profile: UserProfile | Note | UserProfileTerse
) {
	if (wasm && profile.tag) {
		profile.tag.forEach((tag) => {
			if (tag.type === 'Emoji') {
				if (tag.icon) {
					if (text) {
						text = text.replaceAll(
							tag.name,
							`<img class="emoji" src="${cachedContent(wasm, window.Buffer, tag.icon.url)}"/>`
						);
					}
				}
			}
		});
	}

	return text;
}

function timeSince(date: number) {
	const now: number = Date.now();

	const seconds = Math.floor((now - date) / 1000);

	let interval = seconds / 31536000;

	if (interval > 1) {
		return Math.floor(interval) + 'yr';
	}
	interval = seconds / 2592000;
	if (interval > 1) {
		return Math.floor(interval) + 'mo';
	}
	interval = seconds / 86400;
	if (interval > 1) {
		return Math.floor(interval) + 'd';
	}
	interval = seconds / 3600;
	if (interval > 1) {
		return Math.floor(interval) + 'h';
	}
	interval = seconds / 60;
	if (interval > 1) {
		return Math.floor(interval) + 'm';
	}
	return Math.floor(seconds) + 's';
}

function compare(a: DisplayNote, b: DisplayNote) {
	if (Date.parse(a.created_at) < Date.parse(b.created_at)) {
		return -1;
	} else if (Date.parse(a.created_at) > Date.parse(b.created_at)) {
		return 1;
	} else {
		return 0;
	}
}

function extractMaxMin(url: string): { value: string | null; type: 'max' | 'min' | null } {
	const parsedUrl = new URL(url);
	const maxValue = parsedUrl.searchParams.get('max');
	const minValue = parsedUrl.searchParams.get('min');

	if (maxValue) {
		return { value: maxValue, type: 'max' };
	} else if (minValue) {
		return { value: minValue, type: 'min' };
	} else {
		return { value: null, type: null };
	}
}

// TODO: This should probably match specifically on this server since that's the only place UUIDs will be relevant
function extractUuid(id: string): string | null {
	const re =
		/https:\/\/(?:[a-zA-Z0-9.-]+)(?:\.[a-zA-Z0-9.-]+)+\/(?:notes|conversation)\/([a-zA-Z0-9-]+)/;
	const match = id.match(re);

	if (match && match[1]) {
		return match[1];
	} else {
		return null;
	}
}

function domainMatch(site1: string, site2: string): boolean {
	const re = /(https:\/\/(?:[a-zA-Z0-9.-]+)(?:\.[a-zA-Z0-9.-]+)+)\/.*/;
	const site1_match = site1.match(re);
	const site2_match = site2.match(re);

	return site1_match !== null && site2_match !== null && site1_match[1] == site2_match[1];
}

// After several iterations, I'm using base64 here even though it's really invonvenient (i.e., I have
// to add a bunch of dependencies and fiddle with Vite to make it work). I tried just URI encoding the
// URL, but that causes problems when the URL already includes URI encoding (i.e., I'm not the only one
// who's had that idea). The resultant decoded URL ends up broken because the original URI decoding also
// gets decoded at the core server.
function cachedContent(
	wasm: typeof import('enigmatick_wasm') | null,
	buffer: any,
	url: string
): string {
	//if (buffer) {
	if (wasm) {
		let encoded = wasm.get_url_safe_base64(url);
		//let encoded = buffer.from(url).toString('base64').replaceAll('=','')
		//return '/api/cache?url=' + encodeURIComponent(encoded);
		return '/api/cache?url=' + encoded;
	} else {
		return url;
	}
}
