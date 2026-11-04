// Original Creatures blueprint — the creative identity layer.
// 19 three-stage families (57) + 37 two-stage families (74) + 8 standalones + 11 sealed = 150.
// The build script fills stats / learnsets / abilities / ids from this.
// role: spec | phys | bulk | fast | bal | util
// t: type array per stage (primary first). Types from the 17-type chart (no Fairy).

export const THREE = [
  { key: "fernlynx", base: "fern lynx", role: "spec", stages: [
    { n: "Fernling", t: ["grass"] }, { n: "Frondlynx", t: ["grass"] }, { n: "Thornmane", t: ["grass", "rock"] } ] },
  { key: "emberlizard", base: "ember salamander", role: "phys", stages: [
    { n: "Cindcub", t: ["fire"] }, { n: "Emberpaw", t: ["fire"] }, { n: "Pyrelynx", t: ["fire", "fighting"] } ] },
  { key: "tideotter", base: "river otter", role: "bal", stages: [
    { n: "Rivpup", t: ["water"] }, { n: "Ottersurge", t: ["water"] }, { n: "Tidewarden", t: ["water", "ground"] } ] },
  { key: "cragturtle", base: "snapping turtle", role: "bulk", stages: [
    { n: "Snaplet", t: ["water"] }, { n: "Cragshell", t: ["water", "rock"] }, { n: "Bastioturtle", t: ["water", "rock"] } ] },
  { key: "sparkrodent", base: "spark squirrel", role: "fast", stages: [
    { n: "Sparkit", t: ["electric"] }, { n: "Voltnip", t: ["electric"] }, { n: "Thundril", t: ["electric"] } ] },
  { key: "stonebeetle", base: "stone beetle", role: "bulk", stages: [
    { n: "Pebblug", t: ["rock", "bug"] }, { n: "Gravelcarl", t: ["rock", "bug"] }, { n: "Boulderon", t: ["rock", "ground"] } ] },
  { key: "dustmoth", base: "dust moth", role: "spec", stages: [
    { n: "Mothlet", t: ["bug"] }, { n: "Dustwing", t: ["bug", "flying"] }, { n: "Lumothra", t: ["bug", "flying"] } ] },
  { key: "mystfox", base: "mystic fox", role: "spec", stages: [
    { n: "Kitsol", t: ["psychic"] }, { n: "Mystifox", t: ["psychic"] }, { n: "Orakitsu", t: ["psychic", "ghost"] } ] },
  { key: "drakeserpent", base: "sky serpent", role: "phys", stages: [
    { n: "Wyrmlet", t: ["dragon"] }, { n: "Drakoil", t: ["dragon"] }, { n: "Sauranox", t: ["dragon"] } ] },
  { key: "lanternghost", base: "lantern wisp", role: "spec", stages: [
    { n: "Wisplit", t: ["ghost"] }, { n: "Lanternox", t: ["ghost", "fire"] }, { n: "Pyreveil", t: ["ghost", "fire"] } ] },
  { key: "monkbrawler", base: "mountain ape", role: "phys", stages: [
    { n: "Scrapup", t: ["fighting"] }, { n: "Brawlmonk", t: ["fighting"] }, { n: "Kombruiser", t: ["fighting", "steel"] } ] },
  { key: "sealice", base: "ice seal", role: "bulk", stages: [
    { n: "Floepup", t: ["ice"] }, { n: "Glaciff", t: ["ice"] }, { n: "Permabrim", t: ["ice", "water"] } ] },
  { key: "shadewolf", base: "shadow wolf", role: "fast", stages: [
    { n: "Shadepup", t: ["dark"] }, { n: "Nightfang", t: ["dark"] }, { n: "Umbrawulf", t: ["dark", "ghost"] } ] },
  { key: "molebeast", base: "burrowing mole", role: "bulk", stages: [
    { n: "Moldig", t: ["ground"] }, { n: "Burrodon", t: ["ground"] }, { n: "Terravore", t: ["ground", "steel"] } ] },
  { key: "steelgolem", base: "clockwork golem", role: "bulk", stages: [
    { n: "Coggle", t: ["steel"] }, { n: "Ironclad", t: ["steel"] }, { n: "Magnaform", t: ["steel", "electric"] } ] },
  { key: "poisonserpent", base: "sludge serpent", role: "bal", stages: [
    { n: "Sludgle", t: ["poison"] }, { n: "Toxiserp", t: ["poison"] }, { n: "Venomire", t: ["poison", "dark"] } ] },
  { key: "normalmammal", base: "tufted fox", role: "bal", stages: [
    { n: "Tuftkit", t: ["normal"] }, { n: "Fluffox", t: ["normal"] }, { n: "Regalox", t: ["normal", "psychic"] } ] },
  { key: "raptorbird", base: "falcon", role: "phys", stages: [
    { n: "Gustling", t: ["flying"] }, { n: "Falcres", t: ["flying"] }, { n: "Skytalon", t: ["flying", "fighting"] } ] },
  { key: "frostcarp", base: "koi", role: "spec", stages: [
    { n: "Chillkoi", t: ["water"] }, { n: "Frostcarp", t: ["water", "ice"] }, { n: "Glacidon", t: ["water"] } ] },
];

export const TWO = [
  { key: "brindlebeast", base: "badger", role: "bal", stages: [{ n: "Mousling", t: ["normal"] }, { n: "Brindlebeast", t: ["normal"] }] },
  { key: "driftglide", base: "flying squirrel", role: "fast", stages: [{ n: "Pufflet", t: ["normal"] }, { n: "Driftglide", t: ["normal", "flying"] }] },
  { key: "chompkin", base: "boar", role: "phys", stages: [{ n: "Nibbit", t: ["normal"] }, { n: "Chompkin", t: ["normal", "ground"] }] },
  { key: "lullowl", base: "owl", role: "util", stages: [{ n: "Dozowl", t: ["normal"] }, { n: "Lullowl", t: ["normal", "psychic"] }] },
  { key: "carolcrest", base: "songbird", role: "fast", stages: [{ n: "Trillark", t: ["normal", "flying"] }, { n: "Carolcrest", t: ["normal", "flying"] }] },
  { key: "thumpkin", base: "kangaroo", role: "phys", stages: [{ n: "Jabibb", t: ["normal"] }, { n: "Thumpkin", t: ["normal", "fighting"] }] },
  { key: "prickbarr", base: "porcupine", role: "bulk", stages: [{ n: "Quillmouse", t: ["normal"] }, { n: "Prickbarr", t: ["normal", "grass"] }] },
  { key: "finfury", base: "pike fish", role: "phys", stages: [{ n: "Guppet", t: ["water"] }, { n: "Finfury", t: ["water"] }] },
  { key: "medujelly", base: "jellyfish", role: "util", stages: [{ n: "Blubble", t: ["water"] }, { n: "Medujelly", t: ["water", "poison"] }] },
  { key: "gullfin", base: "gull", role: "fast", stages: [{ n: "Splashru", t: ["water"] }, { n: "Gullfin", t: ["water", "flying"] }] },
  { key: "marshog", base: "frog", role: "bulk", stages: [{ n: "Tadmuck", t: ["water"] }, { n: "Marshog", t: ["water", "ground"] }] },
  { key: "crushtide", base: "crab", role: "phys", stages: [{ n: "Nipclaw", t: ["water"] }, { n: "Crushtide", t: ["water", "bug"] }] },
  { key: "cabblade", base: "cabbage knight", role: "phys", stages: [{ n: "Sproutle", t: ["grass"] }, { n: "Cabblade", t: ["grass", "fighting"] }] },
  { key: "thornweed", base: "bramble", role: "bal", stages: [{ n: "Vineling", t: ["grass"] }, { n: "Thornweed", t: ["grass", "poison"] }] },
  { key: "glideleaf", base: "maple seed", role: "fast", stages: [{ n: "Seedwing", t: ["grass"] }, { n: "Glideleaf", t: ["grass", "flying"] }] },
  { key: "loamoss", base: "mossy toad", role: "bulk", stages: [{ n: "Mossmit", t: ["grass"] }, { n: "Loamoss", t: ["grass", "ground"] }] },
  { key: "bloomox", base: "flower ox", role: "util", stages: [{ n: "Budox", t: ["grass"] }, { n: "Bloomox", t: ["grass"] }] },
  { key: "beewing", base: "bee", role: "fast", stages: [{ n: "Grublet", t: ["bug"] }, { n: "Beewing", t: ["bug", "flying"] }] },
  { key: "venbug", base: "centipede", role: "bal", stages: [{ n: "Crawlit", t: ["bug"] }, { n: "Venbug", t: ["bug", "poison"] }] },
  { key: "mandibex", base: "stag beetle", role: "phys", stages: [{ n: "Pincher", t: ["bug"] }, { n: "Mandibex", t: ["bug"] }] },
  { key: "ravenwing", base: "raven", role: "fast", stages: [{ n: "Talonet", t: ["flying"] }, { n: "Ravenwing", t: ["flying"] }] },
  { key: "stoneroc", base: "boulder beast", role: "bulk", stages: [{ n: "Rubble", t: ["rock"] }, { n: "Stoneroc", t: ["rock", "ground"] }] },
  { key: "psygaze", base: "floating orb", role: "spec", stages: [{ n: "Orbling", t: ["psychic"] }, { n: "Psygaze", t: ["psychic"] }] },
  { key: "astralyn", base: "star deer", role: "spec", stages: [{ n: "Mystling", t: ["psychic"] }, { n: "Astralyn", t: ["psychic", "normal"] }] },
  { key: "zenchi", base: "meditating macaque", role: "phys", stages: [{ n: "Monkai", t: ["psychic"] }, { n: "Zenchi", t: ["psychic", "fighting"] }] },
  { key: "hexeer", base: "hex cat", role: "spec", stages: [{ n: "Shadeye", t: ["psychic"] }, { n: "Hexeer", t: ["psychic"] }] },
  { key: "smogoyle", base: "gas gargoyle", role: "bulk", stages: [{ n: "Gaslug", t: ["poison"] }, { n: "Smogoyle", t: ["poison"] }] },
  { key: "toxisaur", base: "swamp lizard", role: "bal", stages: [{ n: "Mirelash", t: ["poison"] }, { n: "Toxisaur", t: ["poison", "water"] }] },
  { key: "zapeel", base: "electric eel", role: "fast", stages: [{ n: "Eelet", t: ["poison"] }, { n: "Zapeel", t: ["poison", "water"] }] },
  { key: "direvex", base: "wolverine", role: "phys", stages: [{ n: "Fangoo", t: ["poison"] }, { n: "Direvex", t: ["poison"] }] },
  { key: "terrapaw", base: "armadillo", role: "phys", stages: [{ n: "Dustkit", t: ["ground"] }, { n: "Terrapaw", t: ["ground", "normal"] }] },
  { key: "craggol", base: "rock golem", role: "bulk", stages: [{ n: "Rockpup", t: ["rock"] }, { n: "Craggol", t: ["rock", "steel"] }] },
  { key: "cindhound", base: "hellhound pup", role: "phys", stages: [{ n: "Flarepup", t: ["fire"] }, { n: "Cindhound", t: ["fire", "dark"] }] },
  { key: "blazerooster", base: "rooster", role: "spec", stages: [{ n: "Emberfowl", t: ["fire"] }, { n: "Blazerooster", t: ["fire", "flying"] }] },
  { key: "zapcrest", base: "thunderbird chick", role: "fast", stages: [{ n: "Voltbird", t: ["electric"] }, { n: "Zapcrest", t: ["electric", "flying"] }] },
  { key: "snowmaw", base: "ice cub", role: "bulk", stages: [{ n: "Frostcub", t: ["ice"] }, { n: "Snowmaw", t: ["ice"] }] },
  { key: "wyverng", base: "wyvern", role: "phys", stages: [{ n: "Drakit", t: ["dragon"] }, { n: "Wyverng", t: ["dragon"] }] },
];

export const SINGLES = [
  { n: "Pelibeak", t: ["water", "normal"], role: "bal", base: "pelican" },
  { n: "Lumifish", t: ["water"], role: "spec", base: "anglerfish" },
  { n: "Mirecroak", t: ["poison", "water"], role: "bulk", base: "toad" },
  { n: "Cervandra", t: ["grass", "normal"], role: "bal", base: "deer" },
  { n: "Sabrewind", t: ["normal", "ice"], role: "fast", base: "snow leopard" },
  { n: "Golmite", t: ["ground", "rock"], role: "bulk", base: "sand golem" },
  { n: "Voltmoth", t: ["bug", "electric"], role: "spec", base: "electric moth" },
  { n: "Cryptbat", t: ["dark", "flying"], role: "fast", base: "vampire bat" },
];

export const SEALED = [
  { n: "Aegisteel", t: ["steel", "psychic"], role: "bulk", rarity: "legendary", lore: "The warden-golem said to seal the arena gates." },
  { n: "Magmaroth", t: ["fire", "rock"], role: "phys", rarity: "legendary", lore: "A titan that sleeps in the caldera, waking to erupt." },
  { n: "Leviacoil", t: ["water", "dragon"], role: "spec", rarity: "legendary", lore: "The coiling leviathan of the trench deeps." },
  { n: "Voltraptor", t: ["electric", "flying"], role: "fast", rarity: "legendary", lore: "A storm-raptor that nests in thunderheads." },
  { n: "Colossand", t: ["ground", "rock"], role: "bulk", rarity: "legendary", lore: "A dune colossus that walks the deep desert." },
  { n: "Borealis", t: ["water", "ice"], role: "spec", rarity: "legendary", lore: "The aurora-crowned leviathan of the frozen seas." },
  { n: "Nocturnyx", t: ["dark", "dragon"], role: "phys", rarity: "legendary", lore: "A void-wyrm that devours the last light of dusk." },
  { n: "Oraceleste", t: ["psychic", "dragon"], role: "spec", rarity: "legendary", lore: "A celestial serpent that charts the stars." },
  { n: "Sylphage", t: ["grass", "psychic"], role: "util", rarity: "mythical", lore: "The forest sprite that only the pure of heart glimpse." },
  { n: "Relictar", t: ["bug", "steel"], role: "bulk", rarity: "mythical", lore: "An ancient relic-beetle sealed in amber and bronze." },
  { n: "Wanderae", t: ["normal", "psychic"], role: "bal", rarity: "mythical", lore: "A wanderer that drifts between arenas unseen." },
];
