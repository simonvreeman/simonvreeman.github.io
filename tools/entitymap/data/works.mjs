// Named Work entities for the Stoicism library.
// @type is the custom WORK_TYPE (EntityMap has no Book/CreativeWork core type).
// Every chunk text is a VERBATIM passage copied from the cited source page's HTML
// (entities decoded, inline tags stripped). Do not paraphrase.

import { WORK_TYPE } from './vocabulary.mjs';

export const works = [
  {
    entityId: 'work-meditations',
    '@type': WORK_TYPE,
    name: 'Meditations',
    description: "The private Stoic notebook of Marcus Aurelius (Greek: Ta eis heauton, 'to himself'), here in Gregory Hays's Modern Library translation.",
    sameAs: ['https://www.wikidata.org/wiki/Q1152283'],
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-marcus-aurelius', targetName: 'Marcus Aurelius' },
      { predicate: 'TRANSLATED_BY', targetId: 'person-gregory-hays', targetName: 'Gregory Hays' },
      { predicate: 'INSTANCE_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'work-meditations-c1',
        text: 'Meditations is a series of personal writings by Marcus Aurelius, Roman Emperor from 161 to 180 AD, recording his private notes to himself and ideas on Stoic philosophy.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'work-meditations-quotes',
    '@type': WORK_TYPE,
    name: 'Meditations: Selected Quotes',
    description: 'A companion page collecting thematic quotations from the Meditations (memento mori, the four virtues, amor fati), arranged as a month-by-month reading.',
    relations: [
      { predicate: 'PART_OF', targetId: 'work-meditations', targetName: 'Meditations' },
      { predicate: 'RELATES_TO', targetId: 'concept-memento-mori', targetName: 'Memento mori' },
    ],
    hasChunks: [
      {
        chunkId: 'work-meditations-quotes-c1',
        text: 'The Daily Stoic is a book by Ryan Holiday and Stephen Hanselman. It has 366 Meditations on Wisdom, Perseverance, and the Art of Living. For 143 of the 366 the days they have taken sections from Meditations by Marcus Aurelius.',
        sourceUrl: 'https://vreeman.com/meditations/quotes',
        pageTitle: '📘 Meditations by Marcus Aurelius: Quotes in books',
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.85,
      },
    ],
  },
  {
    entityId: 'work-discourses',
    '@type': WORK_TYPE,
    name: 'Discourses of Epictetus',
    description: "The surviving lectures of Epictetus as recorded by his pupil Arrian, hosted in Robert Dobbin's modern translation.",
    sameAs: ['https://www.wikidata.org/wiki/Q4357914'],
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-epictetus', targetName: 'Epictetus' },
      { predicate: 'TRANSLATED_BY', targetId: 'person-robert-dobbin', targetName: 'Robert Dobbin' },
      { predicate: 'INSTANCE_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'work-discourses-c1',
        text: 'They were students of Epictetus. In a prefatory letter one such pupil, Arrian by name (c. AD 86-160), takes credit for committing a sizeable number of Epictetus’ lessons to print, thereby ensuring their survival. These are the Discourses.',
        sourceUrl: 'https://vreeman.com/discourses/',
        pageTitle: '📕 Arrian’s Discourses of Epictetus.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'work-enchiridion',
    '@type': WORK_TYPE,
    name: 'Enchiridion of Epictetus',
    description: "The 'Handbook' of Epictetus, a short manual of selected teachings compiled by Arrian that opens with the dichotomy of control.",
    sameAs: ['https://www.wikidata.org/wiki/Q2137133'],
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-epictetus', targetName: 'Epictetus' },
      { predicate: 'PART_OF', targetId: 'work-discourses', targetName: 'Discourses of Epictetus' },
      { predicate: 'TRANSLATED_BY', targetId: 'person-robert-dobbin', targetName: 'Robert Dobbin' },
    ],
    hasChunks: [
      {
        chunkId: 'work-enchiridion-c1',
        text: 'We are responsible for some things, while there are others for which we cannot be held responsible. The former include our judgement, our impulse, our desire, aversion and our mental faculties in general; the latter include the body, material possessions, our reputation, status – in a word, anything not in our power to control.',
        sourceUrl: 'https://vreeman.com/discourses/enchiridion',
        pageTitle: '📕 Arrian’s Enchiridion or Handbook of Epictetus. Translated and edited by Robert Dobbin.',
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'work-fragments',
    '@type': WORK_TYPE,
    name: 'Fragments of Epictetus',
    description: 'Brief quotations of Epictetus not found in the surviving Discourses, mostly preserved in the anthology of Stobaeus.',
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-epictetus', targetName: 'Epictetus' },
      { predicate: 'PART_OF', targetId: 'work-discourses', targetName: 'Discourses of Epictetus' },
      { predicate: 'TRANSLATED_BY', targetId: 'person-robert-dobbin', targetName: 'Robert Dobbin' },
    ],
    hasChunks: [
      {
        chunkId: 'work-fragments-c1',
        text: 'Epictetus said that we must find a method for managing assent. In the field of assent we have to be careful to use it with reservation, with restraint and in the service of society. Drop desire altogether and apply aversion to nothing that is not under our control.',
        sourceUrl: 'https://vreeman.com/discourses/fragments',
        pageTitle: '📕 Arrian’s Fragments of Epictetus. Translated and edited by Robert Dobbin.',
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.85,
      },
    ],
  },
  {
    entityId: 'work-discourses-george-long',
    '@type': WORK_TYPE,
    name: 'Discourses and Enchiridion (George Long translation)',
    description: "George Long's public-domain English translation of Epictetus's Discourses and Enchiridion, hosted as a single page.",
    relations: [
      { predicate: 'INSTANCE_OF', targetId: 'work-discourses', targetName: 'Discourses of Epictetus' },
      { predicate: 'AUTHORED_BY', targetId: 'person-epictetus', targetName: 'Epictetus' },
      { predicate: 'TRANSLATED_BY', targetId: 'person-george-long', targetName: 'George Long' },
    ],
    hasChunks: [
      {
        chunkId: 'work-discourses-george-long-c1',
        text: 'We must make the best use that we can of the things which are in our power, and use the rest according to their nature. What is their nature then? As God may please.',
        sourceUrl: 'https://vreeman.com/discourses/george-long',
        pageTitle: '📕 Arrian’s Discourses and Enchiridion of Epictetus. Translation by George Long.',
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.85,
      },
    ],
  },
  {
    entityId: 'work-moral-letters',
    '@type': WORK_TYPE,
    name: 'Moral Letters to Lucilius',
    description: "Seneca's collection of letters to his friend Lucilius (Epistulae Morales ad Lucilium), the section's core Seneca work, presented as individual letters.",
    sameAs: ['https://www.wikidata.org/wiki/Q1378660'],
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-seneca', targetName: 'Seneca the Younger' },
      { predicate: 'INSTANCE_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'work-moral-letters-c1',
        text: "Seneca's essays and the Letters to Lucilius shaped Stoicism into a practical philosophy for daily life. He wrote about anger, grief, time, wealth, and the cultivation of virtue, urging readers to align reason with nature and to meet adversity with steadiness.",
        sourceUrl: 'https://vreeman.com/seneca/',
        pageTitle: '📗 Letters and Essays from Roman Stoic philosopher Seneca the Younger',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'work-on-the-shortness-of-life',
    '@type': WORK_TYPE,
    name: 'On the Shortness of Life',
    description: "Seneca's essay De Brevitate Vitae, arguing that life is not short but largely wasted, and urging it be lived wisely.",
    sameAs: ['https://www.wikidata.org/wiki/Q1539277'],
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-seneca', targetName: 'Seneca the Younger' },
      { predicate: 'INSTANCE_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'work-on-the-shortness-of-life-c1',
        text: 'It is not that we have a short space of time, but that we waste much of it. Life is long enough, and it has been given in sufficiently generous measure to allow the accomplishment of the very greatest things if the whole of it is well invested.',
        sourceUrl: 'https://vreeman.com/seneca/on-the-shortness-of-life',
        pageTitle: '📗 On the shortness of life (De Brevitate Vitae) - Seneca',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'work-on-the-tranquillity-of-mind',
    '@type': WORK_TYPE,
    name: 'On Tranquillity of Mind',
    description: "Seneca's essay De Tranquillitate Animi on achieving peace of mind.",
    sameAs: ['https://www.wikidata.org/wiki/Q3704175'],
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-seneca', targetName: 'Seneca the Younger' },
      { predicate: 'INSTANCE_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'work-on-the-tranquillity-of-mind-c1',
        text: 'When I made examination of myself, it became evident, Seneca, that some of my vices are uncovered and displayed so openly that I can put my hand upon them, some are more hidden and lurk in a corner, some are not always present but recur at intervals; and I should say that the last are by far the most troublesome, being like roving enemies that spring upon one when the opportunity offers, and allow one neither to be ready as in war, nor to be off guard as in peace.',
        sourceUrl: 'https://vreeman.com/seneca/on-the-tranquillity-of-mind',
        pageTitle: '📗 On the tranquillity of mind (De Tranquillitate Animi) - Seneca',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'work-courage-under-fire',
    '@type': WORK_TYPE,
    name: "Courage Under Fire: Testing Epictetus's Doctrines in a Laboratory of Human Behavior",
    description: "Stockdale's lecture recounting how Epictetus's Stoic doctrines sustained him as a POW.",
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-james-stockdale', targetName: 'James Bond Stockdale' },
      { predicate: 'PART_OF', targetId: 'work-stockdale-collection', targetName: 'James B. Stockdale on Stoicism' },
      { predicate: 'RELATES_TO', targetId: 'person-epictetus', targetName: 'Epictetus' },
    ],
    hasChunks: [
      {
        chunkId: 'work-courage-under-fire-c1',
        text: 'I came to the philosophic life as a thirty-eight-year-old naval pilot in grad school at Stanford University. I had been in the Navy for twenty years and scarcely ever out of a cockpit.',
        sourceUrl: 'https://vreeman.com/stockdale/courage-under-fire',
        pageTitle: "Courage Under Fire: Testing Epictetus's Doctrines in a Laboratory of Human Behavior - James Stockdale",
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'work-master-of-my-fate',
    '@type': WORK_TYPE,
    name: 'Master of My Fate: A Stoic Philosopher in a Hanoi Prison',
    description: "Stockdale's essay on applying Epictetus's Stoicism during his captivity in Hanoi.",
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-james-stockdale', targetName: 'James Bond Stockdale' },
      { predicate: 'PART_OF', targetId: 'work-stockdale-collection', targetName: 'James B. Stockdale on Stoicism' },
      { predicate: 'RELATES_TO', targetId: 'person-epictetus', targetName: 'Epictetus' },
    ],
    hasChunks: [
      {
        chunkId: 'work-master-of-my-fate-c1',
        text: 'When I debated Al Gore and Dan Quayle on television in October 1992, as candidates for vice president, I began my remarks with two questions that are perennially debated by every thinking human being: Who am I? Why am I here?',
        sourceUrl: 'https://vreeman.com/stockdale/master-of-my-fate',
        pageTitle: 'Master of My Fate: A Stoic Philosopher in a Hanoi Prison - James Stockdale',
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'work-stoic-warriors-triad',
    '@type': WORK_TYPE,
    name: "The Stoic Warrior's Triad: Tranquility, Fearlessness and Freedom",
    description: "Stockdale's lecture presenting Epictetus's code of conduct and the Stoic triad of tranquility, fearlessness, and freedom.",
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-james-stockdale', targetName: 'James Bond Stockdale' },
      { predicate: 'PART_OF', targetId: 'work-stockdale-collection', targetName: 'James B. Stockdale on Stoicism' },
      { predicate: 'RELATES_TO', targetId: 'person-epictetus', targetName: 'Epictetus' },
    ],
    hasChunks: [
      {
        chunkId: 'work-stoic-warriors-triad-c1',
        text: 'Somebody asked Epictetus: "What is the fruit of all these doctrines?" He answered with three sharp words: "Tranquility, Fearlessness, and Freedom."',
        sourceUrl: 'https://vreeman.com/stockdale/stoic-warriors-triad',
        pageTitle: "The Stoic Warrior's Triad: Tranquility, Fearlessness and Freedom - James Stockdale",
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'work-stockdale-collection',
    '@type': WORK_TYPE,
    name: 'James B. Stockdale on Stoicism',
    description: "The Stockdale section: a collection of his essays and lectures on applying Stoicism (Courage Under Fire, The Stoic Warrior's Triad, Master of My Fate).",
    relations: [
      { predicate: 'AUTHORED_BY', targetId: 'person-james-stockdale', targetName: 'James Bond Stockdale' },
      { predicate: 'INSTANCE_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'work-stockdale-collection-c1',
        text: 'This collection, often referred to as Stockdale on Stoicism, presents essays and lectures that connect ancient Stoic ethics to modern leadership and resilience.',
        sourceUrl: 'https://vreeman.com/stockdale/',
        pageTitle: 'James B. Stockdale on Stoicism - Essays and Lectures',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.9,
      },
    ],
  },
];
