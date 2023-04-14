export type {
    UserProfile,
    EnigmatickEvent,
    EnigmatickEventObject,
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
export { insertEmojis, timeSince, compare, getWebFingerFromId, sleep, DisplayNote, extractUuid };

interface DisplayNote {
    note: Note;
    actor: UserProfile;
    published: string;
    replies: Map<string, DisplayNote>;
}

class DisplayNote {
    note: Note;
    actor: UserProfile;
    published: string;
    replies: Map<string, DisplayNote>;

    constructor(profile: UserProfile, note: Note, replies?: Map<string, DisplayNote>) {
        this.note = note;
        this.actor = profile;

        if (note.ephemeralTimestamp) {
            this.published = note.ephemeralTimestamp;
        } else {
            this.published = String(note.published);
        }

        this.replies = replies || new Map<string, DisplayNote>();
    }
}

interface Image {
    mediaType?: string;
    type: string;
    url: string;
};

interface AnnounceParams {
    url: string;
    name: string;
    others: string;
}

interface Capabilities {
    acceptsChatMessages?: boolean;
    enigmatickEncrption?: boolean;
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
};

interface EnigmatickEventObject {
    id: string;
};

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
};

interface Announce {
    '@context': string;
    id: string;
    actor: string;
    cc: string[];
    to: string[];
    object: string;
    published: string;
    type: 'Announce';
};

interface Tag {
    type: 'Mention' | 'Emoji' | 'Hashtag';
    name: string;
    href?: string | null;
    id?: string;
    updated?: string;
    icon?: Image;
    value?: string | null;
};

interface Attachment {
    type: 'PropertyValue' | 'Document' | 'IdentityProof';
    name?: string | null;
    value?: string | null;
    mediaType?: string | null;
    url?: string | null;
    blurhash?: string | null;
    width?: number | null;
    height?: number | null;
};

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
};

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
    ephemeralAnnounces?: string[] | null;
    ephemeralAnnounced?: boolean | null;
    ephemeralActors?: UserProfile[];
    ephemeralLiked?: boolean | null;
    ephemeralLikes?: string[] | null;
    ephemeralTargeted?: boolean | null;
    ephemeralTimestamp?: string | null;
    ephemeralMetadata?: Metadata[] | null;
};

interface StreamConnect {
    uuid: string;
};

interface OlmSessionResponse {
    session_pickle: string;
    uuid: string;
};

interface Instrument {
    type: 'IdentityKey' | 'SessionKey' | 'OlmSession';
    content: string;
    hash?: string;
    uuid?: string;
};

interface QueueItem {
    '@context'?: string | null;
    attributedTo: string;
    id: string;
    tag?: object[];
    type: 'EncryptedNote' | 'EncryptedSession' | 'VaultNote';
    to: string[] | string;
    published: string;
    content: string;
    conversations?: string;
    instrument?: Instrument[] | Instrument;
};

interface Collection {
    '@context': string;
    type: 'Collection' | 'OrderedCollection';
    id: string;
    totalItems: number;
    items?: QueueItem[];
    orderedItems?: QueueItem[];
};

interface VaultedMessage {
    message: string;
    published: string;
    attributedTo?: string;
};

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getWebFingerFromId(actor: UserProfile): string {
    const re = /^https:\/\/([a-zA-Z0-9\-.]+?)\/[A-Za-z0-9/\-._]+$/;

    if (actor.id) {
        const match = actor.id.match(re);

        if (match) {
            return `@${actor.preferredUsername}@${match[1]}`;
        }
    }

    return String(actor.url);
}

function insertEmojis(text: string, profile: UserProfile | Note) {
    if (profile.tag) {
        profile.tag.forEach((tag) => {
            if (tag.type === 'Emoji') {
                if (tag.icon) {
                    text = text.replaceAll(tag.name, `<img class="emoji" src="${tag.icon.url}"/>`);
                }
            }
        });
    }

    return text;
}

function timeSince(date: number) {
    const now: number = new Date().getTime();

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
    if (Date.parse(a.published) < Date.parse(b.published)) {
        return -1;
    } else if (Date.parse(a.published) > Date.parse(b.published)) {
        return 1;
    } else {
        return 0;
    }
}

function extractUuid(id: string): string | null {
    const re = /https:\/\/(?:[a-zA-Z0-9.-]+)(?:\.[a-zA-Z0-9.-]+)+\/(?:notes|conversation)\/([a-zA-Z0-9-]+)/;
    const match = id.match(re);

    if (match && match[1]) {
        return match[1]
    } else {
        return null;
    }
}