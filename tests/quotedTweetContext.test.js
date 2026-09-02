const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const domScraperSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'domScraper.js'),
    'utf8'
);
const ratingEngineSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ratingEngine.js'),
    'utf8'
);

const selectors = {
    article: 'article[data-testid="tweet"]',
    quote: 'div[role="link"][tabindex="0"]',
    handle: 'div[data-testid="User-Name"] a[role="link"]',
    text: 'div[data-testid="tweetText"]',
    image: 'div[data-testid="tweetPhoto"] img, img[src*="pbs.twimg.com/media"], img[src*="pbs.twimg.com/amplify_video_thumb"]',
    video: 'video[poster*="pbs.twimg.com"], video',
    permalink: 'a[href*="/status/"] time',
    websiteCard: '[data-testid="card.wrapper"]'
};

class TestNodeList extends Array {}

function textElement(value) {
    return {
        nodeType: 1,
        tagName: 'DIV',
        childNodes: [{ nodeType: 3, textContent: value }],
        closest(selector) {
            return selector === selectors.quote ? this.quoteContainer || null : null;
        }
    };
}

function websiteCardElement({ url, site, title, description, imageUrl }) {
    const detailRows = [site, title, description].filter(Boolean).map(textElement);
    const detail = {
        querySelectorAll(selector) {
            return selector === 'div[dir="auto"]' ? new TestNodeList(...detailRows) : new TestNodeList();
        }
    };
    const link = {
        href: url,
        getAttribute(name) {
            return name === 'href' ? this.href : null;
        }
    };
    const image = {
        src: imageUrl,
        getAttribute(name) {
            return name === 'src' ? this.src : null;
        }
    };

    return {
        matches() { return false; },
        querySelector(selector) {
            if (selector === '[data-testid^="card.layout"][data-testid$=".detail"]') return detail;
            if (selector.includes('pbs.twimg.com/card_img/')) return image;
            return null;
        },
        querySelectorAll(selector) {
            return selector === 'a[href]' ? new TestNodeList(link) : new TestNodeList();
        }
    };
}

function createTweetFixture() {
    const mainText = textElement('Main tweet text');
    const quotedText = textElement('Quoted tweet content');
    const mainUserName = {
        closest() { return null; }
    };
    const quotedUserName = {
        closest(selector) {
            return selector === selectors.quote ? quoteContainer : null;
        },
        querySelectorAll(selector) {
            return selector === 'span' ? new TestNodeList() : new TestNodeList();
        }
    };
    const mainHandleLink = {
        getAttribute(name) {
            return name === 'href' ? '/shresh' : null;
        }
    };
    const quotedAvatar = {
        getAttribute(name) {
            return name === 'data-testid' ? 'UserAvatar-Container-dwarkesh_sp' : null;
        }
    };
    const quotedStatusLink = {
        getAttribute(name) {
            return name === 'href' ? '/dwarkesh_sp/status/1890000000000000000' : null;
        }
    };
    const profileImage = {
        tagName: 'IMG',
        src: 'https://pbs.twimg.com/profile_images/1925260306684813315/NjNQZmhZ_mini.jpg',
        closest() { return quotedAvatar; }
    };
    const websiteCard = websiteCardElement({
        url: 'https://t.co/xwmrTCDwAz',
        site: 'mullvad.net',
        title: 'Mullvad VPN was subject to a search warrant. Customer data not compromised | Mullvad VPN',
        description: 'On April 18 at least six police officers visited the Mullvad VPN office with a search warrant.',
        imageUrl: 'https://pbs.twimg.com/card_img/2094218366412009472/mi-OhMUS?format=png&name=240x240'
    });
    const quotedWebsiteCard = websiteCardElement({
        url: 'https://t.co/quotedCard',
        site: 'quoted.example',
        title: 'Quoted website title',
        description: 'Preview attached to the quoted tweet.',
        imageUrl: 'https://pbs.twimg.com/card_img/2094218366412009473/quoted?format=jpg&name=240x240'
    });
    const misleadingVerifiedPopover = {
        contains() { return false; },
        matches(selector) { return selector === selectors.quote; },
        querySelector() { return null; },
        querySelectorAll(selector) {
            return selector === 'img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]'
                ? new TestNodeList(profileImage)
                : new TestNodeList();
        }
    };

    const quoteContainer = {
        contains(element) {
            return element === quotedUserName || element === quotedText || element === quotedWebsiteCard;
        },
        matches(selector) {
            return selector === selectors.quote;
        },
        querySelector(selector) {
            if (selector === 'div[data-testid^="UserAvatar-Container-"]') return quotedAvatar;
            if (selector === 'a[href*="/status/"]') return quotedStatusLink;
            if (selector === 'div[data-testid="User-Name"]') return quotedUserName;
            if (selector === selectors.text) return quotedText;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === selectors.websiteCard) return new TestNodeList(quotedWebsiteCard);
            return selector === 'img[src*="pbs.twimg.com"], video[poster*="pbs.twimg.com"]'
                ? new TestNodeList(profileImage)
                : new TestNodeList();
        }
    };
    quotedText.quoteContainer = quoteContainer;

    const article = {
        dataset: {},
        contains(element) {
            return element === quoteContainer;
        },
        matches() { return false; },
        querySelector(selector) {
            if (selector === selectors.handle) return mainHandleLink;
            // This is the unrelated role/link node that the previous implementation selected.
            if (selector === selectors.quote) return misleadingVerifiedPopover;
            return null;
        },
        querySelectorAll(selector) {
            if (selector === selectors.text) return new TestNodeList(mainText, quotedText);
            if (selector === `div[data-testid="User-Name"], ${selectors.text}`) {
                return new TestNodeList(mainUserName, mainText, quotedUserName, quotedText);
            }
            if (selector === selectors.websiteCard) return new TestNodeList(websiteCard, quotedWebsiteCard);
            return new TestNodeList();
        }
    };

    return { article, quoteContainer };
}

function createContext() {
    const cache = new Map();
    const context = vm.createContext({
        ArrayBuffer,
        clearTimeout,
        console,
        Date,
        document: {
            querySelector() { return null; },
            querySelectorAll() { return []; }
        },
        location: { pathname: '/' },
        Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
        NodeList: TestNodeList,
        setInterval() { return 0; },
        setTimeout,
        tweetCache: {
            get(id) { return cache.get(id); },
            has(id) { return cache.has(id); },
            set(id, value) { cache.set(id, value); }
        },
        browserGet() { return false; }
    });

    vm.runInContext(`
        const TWEET_ARTICLE_SELECTOR = ${JSON.stringify(selectors.article)};
        const QUOTE_CONTAINER_SELECTOR = ${JSON.stringify(selectors.quote)};
        const USER_HANDLE_SELECTOR = ${JSON.stringify(selectors.handle)};
        const TWEET_TEXT_SELECTOR = ${JSON.stringify(selectors.text)};
        const MEDIA_IMG_SELECTOR = ${JSON.stringify(selectors.image)};
        const MEDIA_VIDEO_SELECTOR = ${JSON.stringify(selectors.video)};
        const PERMALINK_SELECTOR = ${JSON.stringify(selectors.permalink)};
        const WEBSITE_CARD_SELECTOR = ${JSON.stringify(selectors.websiteCard)};
        ${domScraperSource}
        ${ratingEngineSource}
    `, context);

    return context;
}

test('home timeline context includes quoted-tweet and website-card details, not profile images', async () => {
    const context = createContext();
    const { article, quoteContainer } = createTweetFixture();

    assert.equal(context.getQuotedTweetContainer(article), quoteContainer);
    assert.deepEqual(Array.from(context.getUserHandles(article)), ['shresh', 'dwarkesh_sp']);

    const fullContext = await context.getFullContext(article, '2094209236586967178', 'unused');

    assert.match(fullContext, /\[QUOTED_TWEET 1890000000000000000\]:/);
    assert.match(fullContext, /Author:@dwarkesh_sp:\nQuoted tweet content/);
    assert.match(fullContext, /\[LINK_PREVIEWS\]:/);
    assert.match(fullContext, /URL: https:\/\/t\.co\/xwmrTCDwAz/);
    assert.match(fullContext, /Site: mullvad\.net/);
    assert.match(fullContext, /Title: Mullvad VPN was subject to a search warrant/);
    assert.match(fullContext, /Description: On April 18 at least six police officers/);
    assert.match(fullContext, /Preview image URL: https:\/\/pbs\.twimg\.com\/card_img\//);
    assert.match(fullContext, /\[QUOTED_TWEET_LINK_PREVIEWS\]:/);
    assert.match(fullContext, /URL: https:\/\/t\.co\/quotedCard/);
    assert.match(fullContext, /Site: quoted\.example/);
    assert.equal((fullContext.match(/https:\/\/t\.co\/quotedCard/g) || []).length, 1);
    assert.doesNotMatch(fullContext, /profile_images/);
});
