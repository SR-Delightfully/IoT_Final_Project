PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

INSERT OR IGNORE INTO Categories (
    category_id,
    category_name,
    category_description,
    category_icon,
    category_image_url
) VALUES
    (1, 'Pokémon', 'Pokémon Trading Card Game products.', 'playing-cards', 'https://cardmerchantdunedin.co.nz/cdn/shop/files/PKM_Collection_Thumbnail_600x.png?v=1767503556'),
    (2, 'Magic: The Gathering', 'Discover Magic: The Gathering booster packs, sealed displays and collectible cards for deck building, drafting and expanding your collection.', 'sparkles', 'https://mktg-assets.tcgplayer.com/content/opengraph/mtg-ultimate-holiday-gift-guide-2024.jpg'),
    (3, 'Yu-Gi-Oh!', 'Explore Yu-Gi-Oh! trading card products, from sealed packs to cards for building and refining your Deck.', 'layers', 'https://www.qinprinting.com/wp-content/uploads/2024/09/Yu-Gi-Oh-card.jpg'),
    (5, 'Riftbound', 'Enter the Rift with League of Legends trading card products, featuring Champions, collectible cards and sealed boosters for building your strategy.', 'swords', 'https://godpackgames.ca/cdn/shop/articles/LOL-1.webp?v=1782316726&width=1100'),
    (7, 'Accessories', 'Protect, organize and personalize your collection with trading card sleeves, deck boxes, binders, toploaders, storage solutions, playmats, dice and tabletop gaming accessories.', 'package', 'https://epiclootcollectibles.com/cdn/shop/collections/ChatGPT_Image_Feb_14_2026_09_38_12_PM.png?crop=center&height=500&v=1771134030&width=600');

INSERT OR IGNORE INTO Products (
    product_id,
    category_id,
    product_name,
    product_description,
    product_company,
    product_image_url,
    product_price_cents,
    product_stock_quantity
) VALUES
    (1, 1, 'Mega Evolution - Delta Reign - Sleeved Booster Pack', '10 Pokémon Cards per pack', 'The Pokémon Company', 'https://facetofacegames.com/cdn/shop/files/895668e6340ce783b12ea9dd3236436cad73c102_Asset_SEA_PAC_PKM_10_10443_102.png?v=1788533303', 899, 30),
    (2, 1, 'Mega Evolution - Pitch Black - Booster Pack', '10 Pokémon Cards per pack', 'The Pokémon Company', 'https://facetofacegames.com/cdn/shop/files/7491514caf652854ef47809997b8254591a54419_Asset_SEA_PAC_PKM_10_10425_120.png?v=1779225507&width=713', 899, 12),
    (3, 1, 'Mega Evolution - Chaos Rising - Booster Pack', '10 Pokémon Cards per pack', 'The Pokémon Company', 'https://facetofacegames.com/cdn/shop/files/e067bc3119d46f6025d1f4ba3c0320c146231b1a_Asset_SEA_PAC_PKM_10_10407_119.webp?v=1775143977&width=713', 999, 6),
    (4, 1, 'Mega Evolution - Base Set - Booster Pack', '10 Pokémon Cards per pack', 'The Pokémon Company', 'https://facetofacegames.com/cdn/shop/files/27f0b0d04a12f902a9cd277bafd6591b30f28ded_Asset_SEA_PAC_PKM_10_10057_127.jpg?v=1752617870&width=713', 1499, 9),
    (5, 1, 'Mega Evolution - Delta Reign - Booster Box', '36 Pokémon TCG: Mega Evolution—Delta Reign booster packs and 10 Pokémon Cards per pack', 'The Pokémon Company', 'https://facetofacegames.com/cdn/shop/files/29da06ea8691f7780071a8661e46624523a7c2c6_Asset_SEA_BOX_PKM_10_10446_120.png?v=1788533302', 29999, 30),
    (6, 1, 'Mega Evolution - 30th Celebration - Booster Bundle', '6 Pokémon TCG: Mega Evolution—30th Celebration booster packs and 6 cards per pack', 'The Pokémon Company', 'https://www.madal.com/Item%20Images/POK10451_1.jpg?resizeh=1200&resizeid=5&resizew=1200', 9999, 12),
    (7, 1, 'Mega Evolution - Perfect Order - Booster Bundle', '6 Pokémon TCG: Mega Evolution - Perfect Order booster packs and 10 Pokémon Cards per pack', 'The Pokémon Company', 'https://facetofacegames.com/cdn/shop/files/9f6b7c82e9aa1d05be9cc168c0ab8ffbd9dca8a2_Asset_SEA_BOX_PKM_10_10377_109.png?v=1768923185', 5999, 6),
    (8, 1, 'Gardevoir V Battle Deck', 'two new Pokémon TCG: V Battle Decks! Each deck has 60 cards.', 'The Pokémon Company', 'https://facetofacegames.com/cdn/shop/files/f22b62dd56c9313ad2349735a9403102efd92ac5_Asset_PSP_PBTD_EN_Gardevoir_V_jpg.jpg?v=1737534613&width=713', 1499, 9),
    (9, 2, 'Magic: The Gathering - The Hobbit - Play Booster Pack', 'Each English Play Booster contains 14 Magic: The Gathering cards from The Hobbit set. Designed for Limited play and drafting, these boosters are also a great way to discover new cards and add Middle-earth characters, creatures and spells to your collection.', 'Wizards of the Coast', 'https://facetofacegames.com/cdn/shop/files/6128cd144054b574a5d88de061db6986314a1af9_Asset_SEA_PAC_MTG_D56580000.jpg?v=1778275988&width=1946', 899, 36),
    (10, 2, 'Magic: The Gathering - The Hobbit - Play Booster Box', 'A sealed display containing 30 English Magic: The Gathering | The Hobbit Play Boosters. Ideal for drafting with friends, Limited events or opening packs to expand your collection. Each Play Booster contains 14 cards.', 'Wizards of the Coast', 'https://gbtoys.com.au/cdn/shop/collections/mtghob_en_play_dspbx_01_01.jpg?v=1779698295', 24999, 8),
    (11, 5, 'Riftbound: League of Legends TCG - Vendetta - Booster Pack', 'An English-language Vendetta booster pack containing 14 Riftbound cards: 7 commons, 3 uncommons, 2 foil rares or higher, 1 foil card of any rarity and 1 token. Discover Champions, new artwork and cards to customize your strategy in the League of Legends Trading Card Game.', 'Riot Games', 'https://facetofacegames.com/cdn/shop/files/400cb6b993c2bebb92f7c6fe3c9a45cfcdfbe052_Asset_SEA_PAC_RBD_RB_04BD01_EN.jpg?v=1774450991&width=1946', 899, 32),
    (12, 5, 'Riftbound: League of Legends TCG - Radiance - Booster Pack', 'An English-language Radiance booster pack containing 14 Riftbound cards. Open a pack to discover cards from the Radiance set, expand your collection and find new options for building your strategy in the League of Legends Trading Card Game.', 'Riot Games', 'https://cdn11.bigcommerce.com/s-ua4dd/images/stencil/1280x1280/products/358222/535461/Gamenerdzimagez9999-3362__12215.1781014401.png?c=2', 899, 24),
    (13, 5, 'Riftbound: League of Legends TCG - Spiritforged - Booster Box', 'A sealed French-language Spiritforged booster display for the Riftbound: League of Legends Trading Card Game. Open packs to discover cards from the Spiritforged set and expand your collection or build new strategies.', 'Riot Games', 'https://bizweb.dktcdn.net/thumb/large/100/445/365/products/8d09ea1352ce2e8fb9d1e68c0f2b5f71-b9549bc6-9b92-4198-b1e6-ffc15a284a81.png?v=1775557426267', 22999, 4),
    (14, 5, 'Riftbound: League of Legends TCG - Unleashed - Champion Deck - Vi', 'A French-language, preconstructed Vi Champion Deck for Riftbound: League of Legends TCG. Ready to take out of the box and play, this deck gives players a focused starting point for bringing Vi to the battlefield.', 'Riot Games', 'https://topshelfco.ca/cdn/shop/files/Riftbound_League_of_Legends_TCG_Unleashed_Champion_Deck_Vi.png?v=1777585499', 2999, 5),
    (15, 7, 'Dragon Shield Matte Sleeves - Standard', 'A pack of 100 Dragon Shield Matte sleeves for standard-size trading cards. The textured matte finish provides a comfortable shuffle feel while helping protect cards from handling and everyday wear. Suitable for games such as Magic: The Gathering and Pokémon.', 'Dragon Shield', 'https://www.stompinggroundstcg.com/cdn/shop/products/Matte-Silver-Spread_600x.png?v=1689360664', 1599, 30),
    (16, 7, 'Ultra PRO Eclipse PRO Sleeves', 'Ultra PRO Eclipse PRO sleeves provide a close-fitting layer of protection for standard-size trading cards. Designed for regular play and collection storage, they help protect cards from scratches, fingerprints and handling.', 'Ultra PRO', 'https://gamezone.no/Media/Cache/Images/7/0/WEB_Image_Sleeves_Eclipse_Pro_Matte_Black_x100_66x_eclipse-matte-black2-635457645_plid_76050.jpeg', 1299, 25),
    (17, 7, 'Ultra PRO Playmat', 'A fabric-surface playmat designed to provide a smooth playing area for trading card games. The non-slip rubber backing helps keep the mat in place during games while protecting cards and sleeves from direct contact with the tabletop.', 'Ultra PRO', 'https://www.bagsunlimited.com/Product%20Images/APLAYMATBLK_2_.jpg?resizeh=1200&resizeid=5&resizew=1200', 2499, 12),
    (18, 7, 'Ultimate Guard Boulder Deck Case', 'The Ultimate Guard Boulder is a rigid, compact deck case with a secure closure and soft-touch finish. Designed to hold up to 100 double-sleeved cards when used with compatible Ultimate Guard sleeves, it keeps a deck protected and ready for play.', 'Ultimate Guard', 'https://madtownhobby.com/cdn/shop/files/ugd010689_web_box_3d_l_1_800x.jpg?v=1734546216', 1999, 15),
    (19, 7, 'Ultra PRO 9-Pocket Trading Card Binder', 'An Ultra PRO 9-pocket binder for organizing, displaying and protecting a trading card collection. The page layout keeps cards arranged in a clear grid, making it easy to browse sets, track a collection or show off favourite pulls.', 'Ultra PRO', 'https://www.sagentech.com/images/urunler/ultra-pro-pro-binder-9-pocket-3977_2.jpg', 2499, 10),
    (20, 7, 'Ultra PRO Toploader Pack', 'Ultra PRO rigid toploaders provide added protection for individual trading cards. Slide a sleeved or unsleeved card into a holder to help keep it flat and shield it from bends, surface wear and handling during storage or transport.', 'Ultra PRO', 'https://cdn.shopify.com/s/files/1/0327/9089/files/3_x_4_inches_Super_Thick_130pt_Toploader_with_Thick_Card_Sleeves_480x480.jpg?v=1637525858', 899, 25),
    (21, 7, 'Ultra PRO Card Storage Box', 'A practical Ultra PRO cardboard storage box for keeping trading cards sorted and stored together. Its divided interior is useful for organizing bulk cards, spare decks and growing collections.', 'Ultra PRO', 'https://otakumart.co.nz/cdn/shop/files/3200ct-ultra-pro-card-storage-box.jpg?v=1727133753&width=1080', 599, 20),
    (22, 2, 'Magic: The Gathering - Star Trek - Play Booster Pack (German)', 'A German-language Play Booster from Magic: The Gathering | Star Trek, containing 14 Magic cards. Built for Limited play and drafting, each pack also offers a chance to discover new cards featuring crews, starships and characters from across the Star Trek universe.', 'Wizards of the Coast', 'https://cardcosmos.de/cdn/shop/files/MTG_Star_Trek_1PB_DE.webp?v=1784097284&width=1020', 799, 30),
    (23, 2, 'Magic: The Gathering - Star Trek - Play Booster Box', 'A sealed display of 30 Magic: The Gathering | Star Trek Play Boosters. Each pack contains 14 Magic cards, making the box a great choice for a draft night, opening with friends or adding cards from the crossover set to your collection.', 'Wizards of the Coast', 'https://bluemistcollectibles.com/cdn/shop/files/Magic_the_Gathering_Star_Trek_Play_Booster_Box_open_angle_1.jpg?v=1784451183&width=1024', 21999, 8),
    (24, 2, 'Magic: The Gathering - Star Trek - Collector Booster Pack', 'A premium Star Trek Collector Booster for players and collectors looking for special card treatments. Each pack contains 15 Magic cards, with a focus on rares, foils and showcase-style cards.', 'Wizards of the Coast', 'https://cdn11.bigcommerce.com/s-b4ioc4fed9/images/stencil/1280x1280/products/584495/3922882/NUrSfnf8VzS6JMaYx6d7jBYlY__05705.1784119152.jpg?c=1', 3999, 12),
    (25, 2, 'Magic: The Gathering - Star Trek - Enterprise-Q Scene Box', 'A collectible scene box featuring six scene cards, three Play Boosters and six art cards with a display easel. Arrange the cards together to create a display inspired by the Enterprise-Q crossover artwork.', 'Wizards of the Coast', 'https://cdn11.bigcommerce.com/s-b4ioc4fed9/images/stencil/original/products/584510/3922899/eyo4cc3emsuQaie1hfeImYbwq__03614.1784119195.jpg', 4999, 6),
    (26, 2, 'Magic: The Gathering - Star Trek - Commander Deck Set', 'A set of four ready-to-play 100-card Commander decks: Federation Fleet, Landing Party, Klingon Fury and We Are the Borg. Each deck includes 10 double-sided tokens, a deck box, strategy insert and reference card, with themes built around iconic Star Trek crews and factions.', 'Wizards of the Coast', 'https://cardcosmos.de/cdn/shop/files/MTG_Star_Trek_CD_Set_EN.webp?v=1784097285&width=1020', 29999, 4),
    (27, 2, 'Magic: The Gathering - Star Trek - Federation Fleet Commander Deck', 'A ready-to-play 100-card Commander deck led by Jean-Luc Picard. Build around starships, card draw and the strength of the Federation, with 10 double-sided tokens, a deck box, strategy insert and reference card included.', 'Wizards of the Coast', 'https://cardcosmos.de/cdn/shop/files/MTG_Star_Trek_CD_Federation_Fleet_EN.webp?v=1784097284&width=1020', 8999, 5),
    (28, 2, 'Magic: The Gathering - Star Trek - Klingon Fury Commander Deck', 'A ready-to-play 100-card Commander deck themed around Worf and the Klingon Empire. Focus on aggressive attacks and coordinated combat, with 10 double-sided tokens, a deck box, strategy insert and reference card included.', 'Wizards of the Coast', 'https://static.thcdn.com/productimg/original/17970104-1965352081757320.jpg', 8999, 5),
    (29, 2, 'Magic: The Gathering - Star Trek - Landing Party Commander Deck', 'A ready-to-play 100-card Commander deck led by Commander Spock. Explore a strategy built around lands and landfall, with 10 double-sided tokens, a deck box, strategy insert and reference card included.', 'Wizards of the Coast', 'https://cardcosmos.de/cdn/shop/files/MTG_Star_Trek_CD_Landing_Party_EN.webp?v=1784097284&width=1020', 8999, 5),
    (30, 2, 'Magic: The Gathering - Star Trek - We Are the Borg Commander Deck', 'A ready-to-play 100-card Commander deck themed around the Borg Queen and the Collective. Build an artifact-focused strategy with Borg tokens, supported by 10 double-sided tokens, a deck box, strategy insert and reference card.', 'Wizards of the Coast', 'https://cdn11.bigcommerce.com/s-b4ioc4fed9/images/stencil/original/products/584501/3922890/ZDyWIvuGUz9be24H8NtXckxy2__62013.1784119170.jpg', 8999, 5),
    (31, 2, 'Magic: The Gathering - Star Trek - Beam Me Up Bundle', 'A Star Trek-themed Magic bundle for players and collectors. Includes nine Play Boosters, foil and non-foil basic lands, a traditional foil promo card, and a storage box for keeping the contents together.', 'Wizards of the Coast', 'https://collect.thegamecollection.net/cdn/shop/files/MTGTRK_EN_BndlSpcl-Beam-Up_OtrBx_01_03copy.jpg?v=1784036984&width=1500', 9999, 6),
    (32, 3, 'Yu-Gi-Oh! - Beyond the Brave - Booster Pack', 'An English-language Beyond the Brave booster pack with nine cards. Discover new cards and strategies for your Deck, with a mix of cards from the set and the chance to find higher-rarity pulls.', 'Konami', 'https://totalcards.net/cdn/shop/files/beyond-the-brave-booster-pack.jpg?v=1781879314', 499, 24),
    (33, 3, 'Yu-Gi-Oh! - Magnificent Monsters - Booster Box', 'A sealed English Edition booster box from Magnificent Monsters, featuring a collection of monster cards and support for a range of strategies. A good option for opening multiple packs or expanding a Yu-Gi-Oh! collection.', 'Konami', 'https://www.justahobby.store/cdn/shop/files/MAMO_550.png?v=1779917237', 5499, 8),
    (34, 3, 'Yu-Gi-Oh! - Blue-Eyes White Destiny - Structure Deck', 'An English-language Structure Deck built around the Blue-Eyes strategy. A ready-to-play product for fans of the iconic Blue-Eyes White Dragon, with cards selected to support and upgrade the archetype.', 'Konami', 'https://cdn.chaoscards.co.uk/uploads/prod_img/2_305015_e.png?v=-62169983925', 1999, 10),
    (35, 3, 'Yu-Gi-Oh! - Legendary ARC-V Decks - Set of 3', 'A collection of three ready-to-play decks inspired by the Yu-Gi-Oh! ARC-V series. Includes Odd-Eyes, Lunalight and Speedroid themes, making it a convenient set for players who want several distinct strategies.', 'Konami', 'https://totalcards.net/cdn/shop/files/1777209075_46be7571ff99a4799e347ed29e561de8.jpg?v=1777209238', 3199, 6),
    (36, 3, 'Yu-Gi-Oh! - World Championship 2026 - Limited Booster Pack', 'A limited English-language booster pack released for the 2026 World Championship. A compact collectible release for Yu-Gi-Oh! players and fans following the competitive scene.', 'Konami', 'https://cartoncitocards.com/cdn/shop/files/yugioh_2026_limited_world_championship_booster_box_0e2e7_868a7e03-ce4f-47f9-991a-b72ac50029a9.webp?v=1788037197&width=535', 449, 12),
    (37, 3, 'Yu-Gi-Oh! - Glorious Gallery - Booster Pack', 'A Battles of Legend: Glorious Gallery booster pack featuring five cards. Open packs to discover cards and artwork from the Battles of Legend release and add new options to your Deck.', 'Konami', 'https://cartoncitocards.com/cdn/shop/files/glorious-galler-bp-2.webp?v=1774475438&width=535', 399, 18),
    (38, 3, 'Yu-Gi-Oh! - Blazing Dominion - Booster Pack', 'An English-language Blazing Dominion booster pack with nine cards. Expand your collection and explore new cards and combinations for building or refining a Yu-Gi-Oh! Deck.', 'Konami', 'https://jetcards.uk/cdn/shop/files/1766164802_b41f0c20c875c26cfa183c47b70e0c42_caceb3e6-290e-4337-9398-d969087d282b.jpg?v=1774374780&width=1500', 449, 18),
    (39, 3, 'Yu-Gi-Oh! - Spirit Charmers - All Foil Edition Deck', 'An all-foil edition deck featuring the Spirit Charmers theme. A ready-made product for players who enjoy the archetype and collectors looking for a foil-focused version of the deck.', 'Konami', 'https://moto.anticsonline.co.uk/Product/Image?k=108914911&v=x5T+TVskJNGS1c9uYmjDj36c+LcBZ5gCmrxz7cK59R8%3D&width=1042', 1999, 8),
    (40, 5, 'Riftbound - Origins - Booster Pack', 'An Origins booster pack for the Riftbound: League of Legends Trading Card Game. Each pack contains 14 random cards, including commons, uncommons, rare-or-better cards, a foil card and a rune or token.', 'Riot Games', 'https://remicardtrader.ca/cdn/shop/files/RIFTLEALEGSLEPACK_2_1800x1800.jpg?v=1747941369', 899, 20),
    (41, 5, 'Riftbound - Spiritforged - Champion Deck: Fiora', 'A ready-to-play 56-card Champion Deck built around Fiora. The product also includes a Spiritforged booster pack, paper playmat, deck box and rules booklet, giving players a complete starting point for a game.', 'Riot Games', 'https://cdn.sanity.io/images/dsfx7636/consumer_products_live/34142735b8c35ce534eb8a3c28292c0ca8b46b8c-2560x2560.png?accountingTag=consumer_products', 2999, 6),
    (42, 5, 'Riftbound - Spiritforged - Champion Deck: Rumble', 'A ready-to-play 56-card Champion Deck built around Rumble. Includes a Spiritforged booster pack, paper playmat, deck box and rules booklet for players looking to jump into Riftbound.', 'Riot Games', 'https://www.ryft.com.au/web/image/product.template/67603/image_1920?unique=180f9df', 2999, 6),
    (43, 5, 'Riftbound - Vendetta - Showdown Decks: Zed vs Shen', 'A two-player Riftbound deck set featuring Zed and Shen. The Showdown product includes two complete 56-card decks, two booster packs, two paper playmats, two deck boxes and a rulebook.', 'Riot Games', 'https://topshelfco.ca/cdn/shop/files/Riftbound_League_of_Legends_TCG_Vendetta_Champion_Deck_Zed_vs._Shen.png?v=1780539389', 3999, 5),
    (44, 7, 'Dragon Shield - Matte Dual Sleeves - Standard', 'Standard-size dual matte sleeves designed for trading cards up to 63 × 88 mm. The textured matte back provides a secure shuffle feel, while the dual-layer construction adds protection for cards used in regular play.', 'Dragon Shield', 'https://static.wixstatic.com/media/59f2bf_57252756fc1c4d8398f6ff2cfbbb295a~mv2.png/v1/fill/w_1920%2Ch_1920%2Cal_c%2Cq_95%2Cenc_avif%2Cquality_auto/59f2bf_57252756fc1c4d8398f6ff2cfbbb295a~mv2.png', 1899, 12),
    (45, 7, 'Ultimate Guard - Katana Sleeves - Standard', 'Standard-size card sleeves designed for smooth shuffling and reliable card protection. A practical option for sleeving a complete deck before casual play, events or storage.', 'Ultimate Guard', 'https://cartoncitocards.com/cdn/shop/files/UGD010110.webp?v=1753928980', 1699, 10),
    (46, 7, 'Gamegenic - Prime Sleeves - Standard', 'Clear standard-size sleeves for protecting trading cards from handling and surface wear. Suitable for organizing and protecting cards in a deck or collection.', 'Gamegenic', 'https://unicorncards.co.uk/images/thumbs/0185896_gamegenic-standard-size-prime-sleeves-blue-100-fit-one-piecepokemondigimonmtg-cards-_960.jpeg', 799, 15),
    (47, 7, 'Dragon Shield - Nest 100+ Deck Box', 'A sturdy deck box designed to store and transport a sleeved trading card deck. The compact format keeps cards together between games and fits easily into a regular play bag.', 'Dragon Shield', 'https://www.dragonshield.com/cdn/shop/files/AT-40103-DS-NEST100--w94AEpbt.png?crop=center&height=2048&v=1774611408&width=2048', 1499, 8),
    (48, 7, 'Ultimate Guard - Zipfolio 360 Xenoskin 9-Pocket Binder', 'A zippered 9-pocket portfolio for storing and displaying trading cards. The side-loading pockets and zip closure help keep a collection organized and protected while travelling or browsing.', 'Ultimate Guard', 'https://ultimateguard.com/media/c6/88/e4/1772486952/UGD010210_c.webp', 3999, 6),
    (49, 7, 'Ultra PRO - Platinum Series 9-Pocket Pages', 'Archival-safe 9-pocket pages for organizing standard-size trading cards in a compatible binder. The clear pockets make it easy to view both sides of stored cards while keeping sets arranged in order.', 'Ultra PRO', 'https://cdn.shopify.com/s/files/1/0568/7915/3315/files/platinum-series-pocket-pages-100ct-for-cards-and-photos-767028.png?v=1737074770', 999, 20),
    (50, 7, 'BCW - 800-Count Card Storage Box', 'A cardboard storage box designed for organizing and storing large quantities of trading cards. Useful for sorting bulk cards by set, colour, rarity or collection.', 'BCW', 'https://www.bcwsupplies.com/media/catalog/product/cache/b62e8586ee0110916688f2b39b35a685/1/-/1-bx-802_turn.jpg', 499, 15),
    (51, 7, 'Ultimate Guard - Arkhive 400+ Xenoskin', 'A large storage case designed to hold multiple deck boxes or a substantial card collection. The rigid construction and zip closure help keep stored cards and accessories together during transport.', 'Ultimate Guard', 'https://ultimateguard.com/media/67/9a/04/1772486626/UGD011251_q.webp', 4999, 5),
    (52, 7, 'Ultra PRO - Semi-Rigid Card Holders', 'Semi-rigid holders for protecting individual trading cards during storage, sorting or submission for grading. Their flexible structure provides a protective sleeve-like shell while keeping cards easy to handle.', 'Ultra PRO', 'https://www.pokejeux.ca/cdn/shop/files/ultra-pro-semi-rigid-card-holder-poke-jeux.jpg?v=1708580914', 999, 20),
    (53, 7, 'FanRoll - Dungeons & Dragons 50th Anniversary - Modern Holmes 5-Die Set', 'A five-die collectible set celebrating the 50th anniversary of Dungeons & Dragons. The Modern Holmes-inspired dice are presented in a themed display case and designed for tabletop role-playing sessions and collecting.', 'FanRoll', 'https://thehaventabletop.com/cdn/shop/files/ModernDie_800x.jpg?v=1729291524', 5899, 4),
    (54, 7, 'Sirius Dice - D&D Adventure Dice - Legend of Drizzt', 'A themed polyhedral dice set inspired by the Legend of Drizzt. The black-and-green design gives the set a distinct character, with numbered dice for common tabletop RPG rolls.', 'Sirius Dice', 'https://cdn1.philibertnet.com/702287-thickbox_default/dungeons-dragons-adventure-dice-set-legend-of-drizzt-810113710990.jpg', 2099, 8),
    (55, 7, 'Sirius Dice - D&D Adventure Dice - Wizard Blue', 'A 16-piece class-themed dice set for Dungeons & Dragons, featuring translucent blue dice with contrasting numbering. Designed to provide the dice needed for a Wizard character during tabletop role-playing sessions.', 'Sirius Dice', 'https://siriusdice.com/cdn/shop/files/WizardBLUE_box_flap.png?v=1726860282&width=1214', 2099, 8),
    (56, 7, 'Sirius Dice - D&D Treasure Pack - Randomized Dice Set', 'A randomized seven-piece polyhedral dice set from the Dungeons & Dragons Treasure Pack collection. Each pack includes a themed metal coin and a dice bag, making it a collectible surprise for tabletop role-playing sessions.', 'Sirius Dice', 'https://galaxyof.games/cdn/shop/files/D_DAD_INSTAGRAMPOSTPHOTOsm_1024x1024%402x.jpg?v=1696469208', 2899, 6),
    (57, 7, 'Green Dragonborn - 7-Piece Polyhedral Dice Set', 'A seven-piece polyhedral dice set with a green and gold dragon-inspired finish. Includes the standard range of dice used for tabletop role-playing games, from the four-sided die through the twenty-sided die.', 'Green Dragon Dice', 'https://nordicdice.com/cdn/shop/files/nordicdice-akryl-og-resin-green-dragonborn-dice-set-72952376459588.webp?v=1737104544&width=2048', 1499, 10),
    (58, 7, 'Dungeons & Dragons - Classic RPG Dice Set', 'An officially licensed Dungeons & Dragons dice set containing 11 red polyhedral dice. Includes the dice needed for common ability checks, attacks, damage rolls and saving throws.', 'Wizards of the Coast', 'https://media.kohlsimg.com/is/image/kohls/5897063?hei=620&op_sharpen=1&wid=620', 1299, 10),
    (59, 7, 'Chessex - Gemini Blue-Gold Polyhedral 7-Die Set', 'A seven-die polyhedral set from Chessex featuring a marbled blue-and-gold Gemini finish with white numbering. Includes the standard dice used for tabletop role-playing games.', 'Chessex', 'https://cdn.shoplightspeed.com/shops/638019/files/61385074/image.jpg', 1699, 8),
    (60, 7, 'Chessex - Nebula Luminary Nocturnal Polyhedral 7-Die Set', 'A seven-piece polyhedral dice set from the Chessex Nebula Luminary range, featuring a purple-and-blue nebula finish with glow-in-the-dark details. Designed for tabletop role-playing games and dice collectors.', 'Chessex', 'https://www.miniaturemarket.com/media/53/3a/9d/1752152540/chx27557_1.jpg?ts=1752152540', 1699, 8),
    (61, 7, 'Ultra PRO - Spindown Life Counter - Magic: The Gathering', 'A twenty-sided spindown life counter designed for tracking life totals during Magic: The Gathering games. The numbered layout makes it easy to adjust and read life totals between turns.', 'Ultra PRO', 'https://i.ebayimg.com/images/g/GzEAAOSwicpi3rAG/s-l1600.png', 699, 12),
    (62, 7, 'Gamegenic - Token Holder', 'A compact token box with a secure click-lock lid for storing dice, counters and other small game pieces. The clear design makes it easy to see the contents and keep tabletop accessories together between games.', 'Gamegenic', 'https://www.gamegenic.com/wp-content/uploads/2021/01/Token-Holder.png', 999, 10);

INSERT OR IGNORE INTO BarCodes (
    product_id,
    barcode_value
)
SELECT
    product_id,
    '2000000000' || printf('%02d', product_id)
FROM Products
WHERE product_is_active = 1;

WITH RECURSIVE TagNumbers (
    product_id,
    tag_number,
    stock_quantity
) AS (
    SELECT
        Products.product_id,
        COUNT(ProductTags.product_tag_id) + 1,
        Products.product_stock_quantity
    FROM Products
    LEFT JOIN ProductTags
        ON Products.product_id = ProductTags.product_id
    WHERE Products.product_is_active = 1
    GROUP BY
        Products.product_id,
        Products.product_stock_quantity
    HAVING COUNT(ProductTags.product_tag_id) < Products.product_stock_quantity

    UNION ALL

    SELECT
        product_id,
        tag_number + 1,
        stock_quantity
    FROM TagNumbers
    WHERE tag_number < stock_quantity
)
INSERT OR IGNORE INTO ProductTags (
    product_id,
    product_tag_epc,
    product_tag_status
)
SELECT
    product_id,
    'E280116060000000' ||
        printf('%08X', product_id * 10000 + tag_number),
    'ACTIVE'
FROM TagNumbers;

INSERT OR IGNORE INTO Fridges (
    fridge_id,
    fridge_name,
    fridge_location,
    fridge_min_temperature,
    fridge_max_temperature,
    fridge_min_humidity,
    fridge_max_humidity
) VALUES
    (1, 'Fridge 1', 'Main Store - Display Area', 18, 24, 35, 55),
    (2, 'Fridge 2', 'Backroom - Inventory Storage', 18, 22, 35, 50);

COMMIT;