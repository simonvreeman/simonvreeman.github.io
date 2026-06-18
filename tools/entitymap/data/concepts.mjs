// Named Concept entities for the Stoicism library.
// Every chunk text is a VERBATIM passage copied from the cited source page's HTML
// (entities decoded, inline tags stripped). Do not paraphrase.

export const concepts = [
  {
    entityId: 'concept-stoicism',
    '@type': 'Concept',
    name: 'Stoicism',
    description: "The Hellenistic school of philosophy founded in Athens by Zeno of Citium, treated across this library as both a theoretical system (logic, physics, ethics) and a practical discipline of virtue, fate, and what is within one's control.",
    sameAs: ['https://www.wikidata.org/wiki/Q48235'],
    relations: [
      { predicate: 'INSTANCE_OF', targetId: 'concept-philosophy', targetName: 'Philosophy' },
      { predicate: 'DESCRIBED_BY', targetId: 'work-meditations', targetName: 'Meditations' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-stoicism-c1',
        text: 'Of these Hellenistic systems the most important, both for Romans in general and for Marcus in particular, was the Stoic school. The movement takes its name from the stoa (“porch” or “portico”) in downtown Athens where its founder, Zeno of Citium (332/3–262 B.C.), taught and lectured.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'concept-philosophy',
    '@type': 'Concept',
    name: 'Philosophy',
    description: 'The broader discipline of which Stoicism is one school; in the Hays introduction, traced largely to the fifth-century BC Athenian thinker Socrates.',
    sameAs: ['https://www.wikidata.org/wiki/Q5891'],
    hasChunks: [
      {
        chunkId: 'concept-philosophy-c1',
        text: 'Philosophy in the modern sense is largely the creation of one man, the fifth-century B.C. Athenian thinker Socrates. But it is primarily in the Hellenistic period that we see the rise of philosophical sects, promulgating coherent “belief systems” that an individual could accept as a whole and which were designed to explain the world in its totality.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'concept-logos',
    '@type': 'Concept',
    name: 'Logos',
    description: 'In Stoicism, the all-pervading rational principle that orders and directs the universe—synonymous with nature, Providence, or God—and present in each person as the faculty of reason.',
    sameAs: ['https://www.wikidata.org/wiki/Q379825'],
    relations: [
      { predicate: 'PART_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'DESCRIBED_BY', targetId: 'work-meditations', targetName: 'Meditations' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-logos-c1',
        text: 'Logos operates both in individuals and in the universe as a whole. In individuals it is the faculty of reason. On a cosmic level it is the rational principle that governs the organization of the universe.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'concept-dichotomy-of-control',
    '@type': 'Concept',
    name: 'Dichotomy of control',
    description: "Epictetus's foundational distinction, opening the Enchiridion: some things are within our power (judgement, impulse, desire, aversion) and some are not (the body, property, reputation, office).",
    relations: [
      { predicate: 'PART_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'DESCRIBED_BY', targetId: 'work-enchiridion', targetName: 'Enchiridion of Epictetus' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-dichotomy-of-control-c1',
        text: 'We are responsible for some things, while there are others for which we cannot be held responsible. The former include our judgement, our impulse, our desire, aversion and our mental faculties in general; the latter include the body, material possessions, our reputation, status – in a word, anything not in our power to control.',
        sourceUrl: 'https://vreeman.com/discourses/enchiridion',
        pageTitle: '📕 Arrian’s Enchiridion or Handbook of Epictetus. Translated and edited by Robert Dobbin.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'concept-three-disciplines',
    '@type': 'Concept',
    name: 'The three disciplines',
    description: 'The framework in the Hays introduction (and Meditations 7.54): the disciplines of perception, action, and will—seeing objectively, acting justly, and accepting what is outside our control.',
    relations: [
      { predicate: 'PART_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'DESCRIBED_BY', targetId: 'work-meditations', targetName: 'Meditations' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-three-disciplines-c1',
        text: 'It may be worthwhile, however, to draw attention to one pattern of thought that is central to the philosophy of the Meditations (as well as to Epictetus), and that has been identified and documented in detail by Pierre Hadot. This is the doctrine of the three “disciplines”: the disciplines of perception, of action and of the will.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'concept-four-cardinal-virtues',
    '@type': 'Concept',
    name: 'The four cardinal virtues',
    description: 'The Stoic virtues Marcus highlights (Meditations 3.6): wisdom, justice, courage, and self-control (temperance), held as the highest goods.',
    relations: [
      { predicate: 'PART_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'DESCRIBED_BY', targetId: 'work-meditations', targetName: 'Meditations' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-four-cardinal-virtues-c1',
        text: 'If, at some point in your life, you should come across anything better than justice, honesty, self-control, courage—it must be an extraordinary thing indeed—and enjoy it to the full.',
        sourceUrl: 'https://vreeman.com/meditations/quotes',
        pageTitle: '📘 Meditations by Marcus Aurelius: Quotes in books',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.85,
      },
    ],
  },
  {
    entityId: 'concept-amor-fati',
    '@type': 'Concept',
    name: 'Amor fati',
    description: "The acceptance and love of one's fate, aligned with the Stoic discipline of will and willing acquiescence to whatever the logos has ordained.",
    sameAs: ['https://www.wikidata.org/wiki/Q331009'],
    relations: [
      { predicate: 'PART_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-amor-fati-c1',
        text: 'November: Acceptance / Amor Fati',
        sourceUrl: 'https://vreeman.com/meditations/quotes',
        pageTitle: '📘 Meditations by Marcus Aurelius: Quotes in books',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.8,
      },
    ],
  },
  {
    entityId: 'concept-memento-mori',
    '@type': 'Concept',
    name: 'Memento mori',
    description: "Remembrance of death as a guide to action, as in Marcus's 'You could leave life right now—let that determine what you do and say and think' (Meditations 2.11).",
    sameAs: ['https://www.wikidata.org/wiki/Q1411059'],
    relations: [
      { predicate: 'PART_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'DESCRIBED_BY', targetId: 'work-meditations', targetName: 'Meditations' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-memento-mori-c1',
        text: 'You could leave life right now. Let that determine what you do and say and think.',
        sourceUrl: 'https://vreeman.com/meditations/quotes',
        pageTitle: '📘 Meditations by Marcus Aurelius: Quotes in books',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'concept-providence',
    '@type': 'Concept',
    name: 'Providence',
    description: 'The Stoic conviction that the universe is benevolently ordered by the logos, contrasted in the Hays introduction with the random Epicurean universe.',
    relations: [
      { predicate: 'PART_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'RELATES_TO', targetId: 'concept-logos', targetName: 'Logos' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-providence-c1',
        text: 'The Stoic world is ordered to the nth degree; the Epicurean universe is random, the product of the haphazard conjunctions of billions of atoms. To speak of Providence in such a world is transparently absurd, and while Epicurus acknowledged the existence of gods, he denied that they took any interest in human life.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'concept-stockdale-triad',
    '@type': 'Concept',
    name: 'Tranquility, fearlessness and freedom',
    description: "Stockdale's distilled Stoic triad—tranquility, fearlessness, and freedom—achieved by mastering one's moral purpose and accepting what lies outside one's control.",
    relations: [
      { predicate: 'PART_OF', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'DESCRIBED_BY', targetId: 'work-stoic-warriors-triad', targetName: "The Stoic Warrior's Triad" },
      { predicate: 'RELATES_TO', targetId: 'concept-dichotomy-of-control', targetName: 'Dichotomy of control' },
    ],
    hasChunks: [
      {
        chunkId: 'concept-stockdale-triad-c1',
        text: 'Somebody asked Epictetus: "What is the fruit of all these doctrines?" He answered with three sharp words: "Tranquility, Fearlessness, and Freedom."',
        sourceUrl: 'https://vreeman.com/stockdale/stoic-warriors-triad',
        pageTitle: "The Stoic Warrior's Triad: Tranquility, Fearlessness and Freedom - James Stockdale",
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
];
