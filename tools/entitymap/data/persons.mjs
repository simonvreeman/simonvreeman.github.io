// Named Person entities for the Stoicism library.
// Every chunk text is a VERBATIM passage copied from the cited source page's HTML
// (entities decoded, inline tags stripped). Do not paraphrase.

export const persons = [
  {
    entityId: 'person-marcus-aurelius',
    '@type': 'Person',
    name: 'Marcus Aurelius',
    description: 'Roman emperor (161-180 AD) and Stoic philosopher, last of the Five Good Emperors and author of the Meditations.',
    sameAs: ['https://www.wikidata.org/wiki/Q1430'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'RELATES_TO', targetId: 'person-epictetus', targetName: 'Epictetus' },
    ],
    hasChunks: [
      {
        chunkId: 'person-marcus-aurelius-c1',
        text: 'Marcus Aurelius was a Roman emperor from 161 to 180. He was the last of the Five Good Emperors.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'person-epictetus',
    '@type': 'Person',
    name: 'Epictetus',
    description: 'Greek Stoic philosopher (c. 55-135 AD), born a slave, later freed, who founded a school at Nicopolis; his lectures were recorded by Arrian as the Discourses and Enchiridion.',
    sameAs: ['https://www.wikidata.org/wiki/Q5780'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'RELATES_TO', targetId: 'person-arrian', targetName: 'Arrian' },
    ],
    hasChunks: [
      {
        chunkId: 'person-epictetus-c1',
        text: 'We can only make an educated guess as to the year he was born and the year he died, but are not likely to be far wrong in giving his dates as c.AD 55–135. We know that he was born into slavery because he tells us so, and from an ancient inscription we learn that his mother had been a slave. The place of his birth was Hierapolis, a major Graeco-Roman city in what today is south-western Turkey.',
        sourceUrl: 'https://vreeman.com/discourses/',
        pageTitle: '📕 Arrian’s Discourses of Epictetus.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'person-seneca',
    '@type': 'Person',
    name: 'Seneca the Younger',
    description: 'Lucius Annaeus Seneca, Roman Stoic philosopher and statesman; author of the Moral Letters to Lucilius and moral essays such as On the Shortness of Life.',
    sameAs: ['https://www.wikidata.org/wiki/Q2054'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'person-seneca-c1',
        text: 'Lucius Annaeus Seneca (c. 4 BC - AD 65), known as Seneca the Younger, was a Roman Stoic philosopher, statesman, and dramatist. Born in Corduba (modern Cordoba, Spain), he was educated in Rome and rose to prominence as an orator and writer.',
        sourceUrl: 'https://vreeman.com/seneca/',
        pageTitle: '📗 Letters and Essays from Roman Stoic philosopher Seneca the Younger',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'person-james-stockdale',
    '@type': 'Person',
    name: 'James Bond Stockdale',
    description: "U.S. Navy vice admiral and Vietnam POW who applied Epictetus's Stoicism through years of captivity in Hanoi, later writing and lecturing on it.",
    sameAs: ['https://www.wikidata.org/wiki/Q496264'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'RELATES_TO', targetId: 'person-epictetus', targetName: 'Epictetus' },
    ],
    hasChunks: [
      {
        chunkId: 'person-james-stockdale-c1',
        text: 'James B. Stockdale (James Bond Stockdale) was a U.S. Navy vice admiral and Vietnam War prisoner of war who drew on Epictetus and Stoic philosophy to endure captivity and lead others.',
        sourceUrl: 'https://vreeman.com/stockdale/',
        pageTitle: 'James B. Stockdale on Stoicism - Essays and Lectures',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'person-gregory-hays',
    '@type': 'Person',
    name: 'Gregory Hays',
    description: 'Classicist (University of Virginia) and translator of the Modern Library edition of the Meditations hosted on this site.',
    sameAs: ['https://www.wikidata.org/wiki/Q108127947'],
    hasChunks: [
      {
        chunkId: 'person-gregory-hays-c1',
        text: 'Gregory Hays is an assistant professor of classics at the University of Virginia. He has published articles and reviews on various ancient writers and is currently completing a translation and critical study of the mythographer Fulgentius.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'person-george-long',
    '@type': 'Person',
    name: 'George Long',
    description: "19th-century English classical scholar whose public-domain translation of Epictetus's Discourses and Enchiridion is hosted on this site.",
    sameAs: ['https://www.wikidata.org/wiki/Q1506004'],
    hasChunks: [
      {
        chunkId: 'person-george-long-c1',
        text: 'Arrian’s Discourses and Enchiridion of Epictetus. Translation by George Long.',
        sourceUrl: 'https://vreeman.com/discourses/george-long',
        pageTitle: '📕 Arrian’s Discourses and Enchiridion of Epictetus. Translation by George Long.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.85,
      },
    ],
  },
  {
    entityId: 'person-robert-dobbin',
    '@type': 'Person',
    name: 'Robert Dobbin',
    description: "Translator and editor of the modern Penguin edition of Epictetus's Discourses, Enchiridion, and Fragments hosted on this site.",
    hasChunks: [
      {
        chunkId: 'person-robert-dobbin-c1',
        text: 'Arrian’s Enchiridion or Handbook of Epictetus. Translated and edited by Robert Dobbin.',
        sourceUrl: 'https://vreeman.com/discourses/enchiridion',
        pageTitle: '📕 Arrian’s Enchiridion or Handbook of Epictetus. Translated and edited by Robert Dobbin.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.85,
      },
    ],
  },
  {
    entityId: 'person-arrian',
    '@type': 'Person',
    name: 'Arrian',
    description: "Flavius Arrianus (c. 86-160 AD), Greek-born Roman consul and historian, pupil of Epictetus who transcribed his teacher's lectures into the Discourses and Enchiridion.",
    sameAs: ['https://www.wikidata.org/wiki/Q179293'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'work-discourses', targetName: 'Discourses of Epictetus' },
    ],
    hasChunks: [
      {
        chunkId: 'person-arrian-c1',
        text: 'In a prefatory letter one such pupil, Arrian by name (c. AD 86-160), takes credit for committing a sizeable number of Epictetus’ lessons to print, thereby ensuring their survival. These are the Discourses. Arrian is also credited with preparing a digest of his master’s thought: the Manual or (in Greek) Enchiridion.',
        sourceUrl: 'https://vreeman.com/discourses/',
        pageTitle: '📕 Arrian’s Discourses of Epictetus.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'person-zeno',
    '@type': 'Person',
    name: 'Zeno of Citium',
    description: 'Founder of Stoicism (c. 334-262 BC), who taught at the painted porch (stoa) in Athens from which the school takes its name.',
    sameAs: ['https://www.wikidata.org/wiki/Q170588'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'PRECEDES', targetId: 'person-cleanthes', targetName: 'Cleanthes' },
    ],
    hasChunks: [
      {
        chunkId: 'person-zeno-c1',
        text: 'The movement takes its name from the stoa (“porch” or “portico”) in downtown Athens where its founder, Zeno of Citium (332/3–262 B.C.), taught and lectured. Zeno’s doctrines were reformulated and developed by his successors, Cleanthes (331–232 B.C.) and Chrysippus (280–c. 206 B.C.).',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'definition',
        relevanceScore: 0.95,
      },
    ],
  },
  {
    entityId: 'person-cleanthes',
    '@type': 'Person',
    name: 'Cleanthes',
    description: 'Second head of the Stoic school (331-232 BC), successor to Zeno, who developed and reformulated his doctrines.',
    sameAs: ['https://www.wikidata.org/wiki/Q318767'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'PRECEDES', targetId: 'person-chrysippus', targetName: 'Chrysippus of Soli' },
    ],
    hasChunks: [
      {
        chunkId: 'person-cleanthes-c1',
        text: 'Zeno’s doctrines were reformulated and developed by his successors, Cleanthes (331–232 B.C.) and Chrysippus (280–c. 206 B.C.). Chrysippus in particular was a voluminous writer, and it was he who laid the foundations for systematic Stoicism.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.85,
      },
    ],
  },
  {
    entityId: 'person-chrysippus',
    '@type': 'Person',
    name: 'Chrysippus of Soli',
    description: 'Third head of the Stoa (c. 279-206 BC), the systematizer who divided philosophy into logic, physics, and ethics and refined the doctrine of pneuma.',
    sameAs: ['https://www.wikidata.org/wiki/Q170581'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'concept-stoicism', targetName: 'Stoicism' },
    ],
    hasChunks: [
      {
        chunkId: 'person-chrysippus-c1',
        text: 'Chrysippus and his followers had divided knowledge into three areas: logic, physics and ethics, concerned, respectively, with the nature of knowledge, the structure of the physical world and the proper role of human beings in that world.',
        sourceUrl: 'https://vreeman.com/meditations/',
        pageTitle: '📘 Meditations by Marcus Aurelius. Translation by Gregory Hays.',
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.9,
      },
    ],
  },
  {
    entityId: 'person-musonius-rufus',
    '@type': 'Person',
    name: 'Musonius Rufus',
    description: 'Roman Stoic philosopher who taught and trained Epictetus, launching his career while Epictetus was still a slave.',
    sameAs: ['https://www.wikidata.org/wiki/Q350937'],
    relations: [
      { predicate: 'RELATES_TO', targetId: 'concept-stoicism', targetName: 'Stoicism' },
      { predicate: 'PRECEDES', targetId: 'person-epictetus', targetName: 'Epictetus' },
    ],
    hasChunks: [
      {
        chunkId: 'person-musonius-rufus-c1',
        text: 'The turning point in his life was his adoption by Musonius Rufus, the very best teacher of philosophy in first-century Rome. Though Epictetus was still technically a slave, Rufus, an Etruscan knight, took him as a student.',
        sourceUrl: 'https://vreeman.com/stockdale/stoic-warriors-triad',
        pageTitle: "The Stoic Warrior's Triad: Tranquility, Fearlessness and Freedom - James Stockdale",
        publisher: 'Vreeman.com',
        contentType: 'evidence',
        relevanceScore: 0.9,
      },
    ],
  },
];
