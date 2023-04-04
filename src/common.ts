export type {UserProfile, EnigmatickEvent, EnigmatickEventObject, Announce, Tag, Attachment, Metadata, Note, StreamConnect, DisplayNote };
export { insertEmojis, timeSince, compare };

interface DisplayNote {
    note: Note;
    actor: UserProfile;
    published: string;
    replies: Map<string, DisplayNote>;
}

interface Image {
    mediaType?: string;
    type: string;
    url: string;
};

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
    href?: string;
    id?: string;
    updated?: string;
    icon?: Image;
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
    ephemeralAnnounce?: string | null;
    ephemeralActors?: UserProfile[];
    ephemeralLiked?: boolean | null;
    ephemeralTargeted?: boolean | null;
    ephemeralTimestamp?: string | null;
    ephemeralMetadata?: Metadata[] | null;
};

interface StreamConnect {
    uuid: string;
};

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

function timeSince(date: any) {
    const now: any = new Date();

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