export type {
	UserProfile,
	UserProfileTerse,
	EnigmatickEvent,
	EnigmatickEventObject,
	Activity,
	Article,
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
	VaultedMessage,
	Ephemeral,
	Question
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
	domainMatch,
	convertMastodonUrlToWebfinger,
	formatProfileTags,
	getFirst,
	abbreviateNumber,
	decrypt,
	removeTags,
	isNote,
	isArticle,
	isEncryptedNote,
	isQuestion
};

interface DisplayNote {
	note: Note | Article | Question;
	activity: Activity | undefined;
	actor: UserProfile | UserProfileTerse;
	published: string;
	created_at: string;
	replies: Map<string, DisplayNote>;
	public: boolean;
}

class DisplayNote {
	note: Note | Article | Question;
	activity: Activity | undefined;
	actor: UserProfile | UserProfileTerse;
	published: string;
	created_at: string;
	replies: Map<string, DisplayNote>;
	public: boolean;

	constructor(
		profile: UserProfile | UserProfileTerse,
		note: Note | Article | Question,
		activity?: Activity,
		replies?: Map<string, DisplayNote>
	) {
		this.note = note;
		this.activity = activity;
		this.actor = profile;

		if (note.published) {
			this.published = String(note.published);
		} else if (note.ephemeral?.timestamp) {
			this.published = note.ephemeral.timestamp;
		} else {
			this.published = new Date().toISOString();
		}

		if (note.ephemeral?.timestamp) {
			this.created_at = note.ephemeral.timestamp;
		} else {
			this.created_at = new Date().toISOString();
		}

		this.replies = replies || new Map<string, DisplayNote>();
		this.public = this.isPublic();
	}

	jsonTo(): string {
		let ret: string[] = [];

		this.note.to &&
			(Array.isArray(this.note.to) ? ret.push(...this.note.to) : ret.push(this.note.to));
		this.note.cc &&
			(Array.isArray(this.note.cc) ? ret.push(...this.note.cc) : ret.push(this.note.cc));

		return JSON.stringify(ret);
	}

	jsonSender(): string {
		return JSON.stringify(this.actor);
	}

	isPublic(): boolean {
		const publicIdentifiers = [
			'https://www.w3.org/ns/activitystreams#Public',
			'as:Public',
			'Public'
		];

		let recipients: string[] = [];

		this.note.to &&
			(Array.isArray(this.note.to)
				? recipients.push(...this.note.to)
				: recipients.push(this.note.to));
		this.note.cc &&
			(Array.isArray(this.note.cc)
				? recipients.push(...this.note.cc)
				: recipients.push(this.note.cc));

		return recipients.some((recipient) => publicIdentifiers.includes(recipient));
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
	id?: string;
	url?: string | string[];
	name?: string;
	preferredUsername: string;
	tag?: Tag[] | null;
	icon?: Image;
	webfinger?: string;
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
	url?: string | string[];
	manuallyApprovesFollowers?: boolean;
	published?: string;
	tag?: Tag[];
	attachment?: object;
	endpoints?: object;
	icon?: Image;
	image?: Image;
	capabilities?: Capabilities;
	ephemeral?: Ephemeral;
}

interface Ephemeral {
	following?: boolean;
	leaderApId?: string;
	followActivityAsId?: string;
	summaryMarkdown?: string;
	leaders?: number;
	followers?: number;
	announces?: UserProfileTerse[] | null;
	announced?: string | null;
	actors?: UserProfileTerse[];
	liked?: string | null;
	likes?: UserProfileTerse[] | null;
	targeted?: boolean | null;
	timestamp?: string | null;
	metadata?: Metadata[] | null;
	attributedTo?: UserProfileTerse[] | null;
	createdAt?: string | null;
	updatedAt?: string | null;
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
	type: 'PropertyValue' | 'Document' | 'IdentityProof' | 'Image';
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
	url?: string | null;
}

interface Note {
	type: 'Note' | 'EncryptedNote';
	tag?: Tag[] | Tag | null;
	id?: string;
	to?: string[] | string;
	cc?: string[] | string;
	url?: string;
	attributedTo?: string[] | string | null;
	content?: string | null;
	summary?: string | null;
	replies?: object | null;
	published: string | null;
	inReplyTo?: string | null;
	attachment?: Attachment[] | null;
	conversation?: string | null;
	ephemeral?: Ephemeral;
}

const isNote = (attr: string | Question | Note | Article): attr is Note & { type: 'Note' }=> {
	return typeof attr === 'object' && attr !== null && attr.type === 'Note';
};

const isEncryptedNote = (attr: string | Question | Note | Article): attr is Note & { type: 'EncryptedNote' } => {
	return typeof attr === 'object' && attr !== null && attr.type === 'EncryptedNote';
};

interface Article {
	type: 'Article';
	tag?: Tag[] | Tag | null;
	id?: string;
	to?: string[] | string;
	cc?: string[] | string;
	url?: string;
	attributedTo: string;
	preview?: Note | string | null
	content?: string | null;
	summary?: string | null;
	replies?: object | null;
	published: string | null;
	inReplyTo?: string | null;
	attachment?: Attachment[] | null;
	conversation?: string | null;
	ephemeral?: Ephemeral;
}

const isArticle = (attr: string | Question | Article | Note): attr is Article => {
	return typeof attr === 'object' && attr !== null;
};

interface QuestionCollection {
	totalItems: number;
	type?: 'Collection';
}

interface QuestionNote {
	type: 'Note';
	attributedTo?: string | null;
	to?: string[] | string | null;
	name: string;
	replies?: QuestionCollection | null
}

interface Question {
	type: 'Question';
	tag?: Tag[] | Tag | null;
	id?: string | null;
	to?: string[] | string;
	cc?: string[] | string;
	url?: string | null;
	attributedTo: string;
	oneOf?: QuestionNote[] | QuestionNote | null;
	anyOf?: QuestionNote[] | QuestionNote | null;
	content?: string | null;
	summary?: string | null;
	votersCount?: number | null;
	replies?: object | null;
	published: string | null;
	inReplyTo?: string | null;
	attachment?: Attachment[] | null;
	conversation?: string | null;
	endTime?: string | null;
	ephemeral?: Ephemeral;
}

const isQuestion = (attr: string | Question | Article | Note): attr is Question => {
	return typeof attr === 'object' && attr !== null;
};

interface Activity {
	'@context': string;
	type: 'Create' | 'Announce';
	actor: string;
	to: string[];
	cc: string[];
	id: string;
	object: Note | Article | Question;
	published: string | null;
	instrument?: Instrument[] | null;
	ephemeral?: Ephemeral;
}

interface StreamConnect {
	uuid: string;
}

interface OlmSessionResponse {
	session_pickle: string;
	uuid: string;
}

interface Instrument {
	type: 'OlmIdentityKey' | 'OlmOneTimeKey' | 'OlmSession' | 'VaultItem' | 'OlmAccount';
	content: string;
	hash?: string;
	uuid?: string;
	url?: string;
	mutation_of?: string;
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
	totalItems?: number;
	items?: Activity[];
	orderedItems?: Activity[];
	prev?: string;
	next?: string;
	first?: string;
	last?: string;
	ephemeral?: Ephemeral;
}

interface VaultedMessage {
	message: string;
	published: string;
	attributedTo?: string;
}

function abbreviateNumber(num: number): string {
	const suffixes = ['', 'k', 'M', 'B', 'T'];
	let index = 0;

	while (num >= 1000 && index < suffixes.length - 1) {
		num /= 1000;
		index++;
	}

	// For numbers less than 1000, return as integer
	if (index === 0) {
		return Math.floor(num).toString();
	}

	// For numbers 1000 and above, return with 2 decimal places
	return num.toFixed(1) + suffixes[index];
}

function getFirst(s: string | string[] | undefined): string | undefined {
	if (typeof s === 'string') {
		return s;
	} else if (Array.isArray(s)) {
		return s[0];
	}
	return undefined;
}

const formatProfileTags = (profile: UserProfileTerse): string => {
	const hashTags = profile.tag?.filter((tag) => tag.type === 'Hashtag');

	const tagLinks = hashTags?.map((tag) => {
		return `<a href="${tag.href}">${tag.name}</a>`;
	});

	if (tagLinks) {
		return tagLinks.join(' ');
	} else {
		return '';
	}
};

const convertMastodonUrlToWebfinger = (url: string, short?: boolean): string | null => {
	try {
		const parsedUrl = new URL(url);
		let username = parsedUrl.pathname.slice(1); // Remove the leading '/'
		const domain = parsedUrl.hostname;

		username = username.endsWith('/') ? username.slice(0, -1) : username;

		if (!username.startsWith('@')) {
			//throw new Error('Invalid Mastodon URL format');
			return null;
		}

		if (short) {
			return `${username}`;
		} else {
			return `${username}@${domain}`;
		}
	} catch (error) {
		console.error('Error parsing URL:', error);
		return null;
	}
};

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
	wasm: any,
	//wasm: typeof import('enigmatick_wasm') | null,
	text: string,
	profile: UserProfile | Note | UserProfileTerse | Article | Question
) {
	if (wasm && profile.tag) {
		let tags: Tag[] = [];
		
		if (Array.isArray(profile.tag)) {
			tags = [...profile.tag];
		} else {
			tags.push(profile.tag);
		}

		tags.forEach((tag) => {
			if (tag.type === 'Emoji') {
				if (tag.icon) {
					if (text) {
						text = text.replaceAll(
							tag.name,
							`<img class="emoji" src="${cachedContent(wasm, tag.icon.url)}"/>`
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
//function cachedContent(wasm: typeof import('enigmatick_wasm') | null, url: string): string {
function cachedContent(wasm: any, url: string): string {
	//if (buffer) {
	if (wasm) {
		let encoded = wasm.get_url_safe_base64(url);
		return '/api/cache?url=' + encoded;
	} else {
		return url;
	}
}

function getVaultItem(activity: Activity): Instrument | null {
	if (!activity.instrument) {
		return null;
	}

	const vaultItem = activity.instrument.find((item) => item.type === 'VaultItem');
	return vaultItem || null;
}

const decrypt = (wasm: any, activity: Activity | null | undefined): string => {
	if (activity?.object.type == 'EncryptedNote') {
		let vault;
		if (wasm && (vault = getVaultItem(activity))) {
			return wasm.decrypt_text(vault.content) || '';
		} else {
			return '<span class"failure">Message could not be decrypted</span>';
		}
	} else {
		return activity?.object.content || '';
	}
};

const removeTags = (str: string | null | undefined): string => {
	if (str) {
		return str.replace(/<[^>]*>/g, ' ');
	} else {
		return '';
	}
};
