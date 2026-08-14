// Starter content offered at cookbook creation so a new family's book is
// never empty. The recipes are real ones from the founder family's Kookbook —
// "from our family's cookbook to yours" — credited to "The Kookbook" and
// flagged starter:true so they're recognisable (and freely deletable).
// Generated from the live flagship recipes on 2026-07-04.
//
// ⚠ THESE IMAGE URLs ARE SHARED BY EVERY COOKBOOK EVER CREATED. They point at
// the flagship's original uploads, and seeding copies the URL, not the bytes —
// so one object is on screen in every family's book at once.
//
// This header used to say the files were "immutable in practice — nothing
// deletes old ones". That was true on 2026-07-04 and stopped being true when
// lib/delete-data shipped Storage deletion. On 2026-08-13 a cleanup of test
// households deleted 185 of these objects and blanked 122 recipes across all
// eight live cookbooks; 90-day soft delete is the only reason they came back.
//
// So: never delete an object referenced here, and never assume a file is yours
// to remove just because it is in your household's documents. `delete-data`
// enforces this now — see `pathsReferencedElsewhere`.

export const STARTER_RECIPES = [
  {
    "slug": "bobotie",
    "title": "Bobotie",
    "description": "Classic South African spiced mince bake with a custard topping of egg, mayo and yoghurt. The first dish Poppie learned to make.",
    "category": "mains",
    "image": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fbobotie%2Fopenart-gpt-image-2-1_1779631995328_c4ee4cf7.png?alt=media&token=49b4f380-c2c2-4e50-ae69-5781c6f8929e",
    "images": [
      "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fbobotie%2Fopenart-gpt-image-2-1_1779631995328_c4ee4cf7.png?alt=media&token=49b4f380-c2c2-4e50-ae69-5781c6f8929e"
    ],
    "thumbUrl": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fbobotie%2Fthumb-openart-gpt-image-2-1_1779631995328_c4ee4cf7.png?alt=media&token=d3889454-f64e-4312-9140-1c6e36076502",
    "prepTime": 20,
    "cookTime": 50,
    "servings": 6,
    "difficulty": "Medium",
    "protein": "beef",
    "ingredients": [
      "2 thick slices of good white bread, crusts removed",
      "1 tablespoon vegetable oil",
      "2 tablespoons butter",
      "1 large onion, finely chopped",
      "500g lean beef mince",
      "2 cloves garlic, grated or crushed",
      "1 heaped tablespoon curry powder",
      "1 heaped teaspoon masala (if unavailable, double-up the curry powder)",
      "2 teaspoons turmeric",
      "2 teaspoons ground cumin",
      "2 teaspoons ground coriander",
      "2 tablespoons Mrs Ball's chutney",
      "Salt",
      "1 tablespoon apricot jam",
      "4 bay leaves",
      "1 cup milk",
      "2 eggs",
      "Hellmanns or Heinz mayonnaise",
      "Bulgarian (or Greek) yoghurt",
      "2 tablespoons red wine vinegar"
    ],
    "instructions": [
      "Preheat oven to 180 degrees Celsius. Soak the bread in the milk for 5 minutes, remove and squeeze out any excess milk.",
      "Fry the onions in the oil and butter until just transparent, set aside. Add mince and while it's turning brown add the masala and curry powder, cumin, turmeric and coriander.",
      "Tear the soaked bread into small pieces and add to the meat mixture, mix well. Add chutney, vinegar and apricot jam to the meat. Once cooked put into an oven proof dish.",
      "Beat eggs. Add equal parts of mayo and yoghurt. Pour mix over the meat.",
      "Cook for about 40 minutes or until the top starts browning."
    ],
    "contributedBy": "The Kookbook",
    "story": "I think this was probably the first dish I learned to make, living by myself, in Kommetjie. As I'm sure you've noticed by now, is that I love a dish if it has its own little quirk. Like a little insider joke. Or a distinctive personality trait. This one was the equal amounts of, at that stage, Miracle Whip, and Bulgarian yoghurt for the custard. And then the eggs. Genius overkill.",
    "tags": [
      "south-african",
      "mince",
      "curry",
      "comfort-food",
      "bobotie",
      "classic"
    ]
  },
  {
    "slug": "chicken-soup",
    "title": "Chicken Soup",
    "description": "The natural next step after a good stock. Use the darker meat from the chicken -- the breast is pretty much tasteless by this point.",
    "category": "soups",
    "image": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fchicken-soup%2Fopenart-gpt-image-2-1_1779633713475_25ac3ba1.jpg?alt=media&token=7bdd01a7-3b6e-4662-9a0a-9c1c3f9bfcb6",
    "images": [
      "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fchicken-soup%2Fopenart-gpt-image-2-1_1779633713475_25ac3ba1.jpg?alt=media&token=7bdd01a7-3b6e-4662-9a0a-9c1c3f9bfcb6"
    ],
    "thumbUrl": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fchicken-soup%2Fthumb-openart-gpt-image-2-1_1779633713475_25ac3ba1.jpg?alt=media&token=ff3d060b-f49e-4f35-94d6-4c9fa6b7c1f8",
    "prepTime": 10,
    "cookTime": 20,
    "servings": 4,
    "difficulty": "Easy",
    "protein": "poultry",
    "seasons": [
      "autumn",
      "winter"
    ],
    "ingredients": [
      "Leftover mirepoix (celery, onion, carrot), chopped",
      "Butter",
      "A little garlic, chopped",
      "Chicken stock",
      "Chicken from the stock pot, flaked (darker parts preferred)"
    ],
    "instructions": [
      "Fry up the remaining mirepoix gently in some butter, add a little chopped up garlic.",
      "Add the stock and flake off the darker parts of the chicken. The breast can go in as well but it's pretty much tasteless at this point.",
      "Simmer until everything is heated through and the flavours have come together."
    ],
    "contributedBy": "The Kookbook",
    "story": "For Asian countries, what makes any of these kinds of stock dishes is the fat on the top. That's where the flavour and mouthfeel really lies.",
    "tags": [
      "soup",
      "chicken",
      "comfort-food",
      "simple",
      "stock"
    ]
  },
  {
    "slug": "chakalaka",
    "title": "Chakalaka",
    "description": "A South African classic. Goes best with pap and boerewors. Poppie is under no illusions that either of you will ever make this, but just in case.",
    "category": "sides-salads",
    "image": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fchakalaka%2Fopenart-image_1776107278627_d3ba2cc9_1776107278957_8221277e.jpg?alt=media&token=70e41f3b-5966-49a2-ab70-0b65cf42c013",
    "images": [
      "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fchakalaka%2Fopenart-image_1776107278627_d3ba2cc9_1776107278957_8221277e.jpg?alt=media&token=70e41f3b-5966-49a2-ab70-0b65cf42c013"
    ],
    "thumbUrl": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fchakalaka%2Fthumb-openart-image_1776107278627_d3ba2cc9_1776107278957_8221277e.jpg?alt=media&token=f9d95581-758c-4cdc-806d-3201b556f548",
    "prepTime": 15,
    "cookTime": 25,
    "servings": 6,
    "difficulty": "Easy",
    "protein": "vegan",
    "ingredients": [
      "3 tablespoons sunflower oil",
      "1 onion, finely chopped",
      "2 cloves garlic, crushed",
      "50g ginger, finely grated",
      "2 tablespoons curry powder/masala",
      "1 red pepper, finely chopped",
      "1 yellow pepper, finely chopped",
      "5 large carrots, grated",
      "2 tablespoons tomato puree",
      "400g can chopped tomatoes",
      "400g can baked beans",
      "Salt and pepper to taste"
    ],
    "instructions": [
      "In a pan over medium heat, add the oil. Then add onion and saute until translucent and softened.",
      "Add garlic, ginger and curry powder. Stir to combine. Add peppers. Cook for 2 minutes.",
      "Add carrots. Stir to combine and ensure they're coated in curry powder. Add tomatoes and tomato paste. Stir to combine.",
      "Cook mixture for 5-10 minutes. Mixture should be well combined and thickened slightly.",
      "Add baked beans. Simmer for 5 minutes. Remove from heat.",
      "Serve with pap and boerewors."
    ],
    "contributedBy": "The Kookbook",
    "story": "I'm under no illusions that the two of you will ever make this, but just in case.",
    "tags": [
      "south-african",
      "chakalaka",
      "side-dish",
      "braai",
      "pap",
      "boerewors"
    ]
  },
  {
    "slug": "crunchies",
    "title": "Crunchies",
    "description": "Barbara's classic South African oat bars. The first lockdown batch was superb -- the second became muesli. Double the butter and bicarb.",
    "category": "baking-breads",
    "image": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fcrunchies%2Fopenart-gpt-image-2-1_1779635373610_f9bf76a0.jpg?alt=media&token=09e1dc83-1fe4-4609-87ca-727c90502609",
    "images": [
      "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fcrunchies%2Fopenart-gpt-image-2-1_1779635373610_f9bf76a0.jpg?alt=media&token=09e1dc83-1fe4-4609-87ca-727c90502609"
    ],
    "thumbUrl": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fcrunchies%2Fthumb-openart-gpt-image-2-1_1779635373610_f9bf76a0.jpg?alt=media&token=9053230a-8c7f-41c1-aab5-00949b1be6e6",
    "prepTime": 15,
    "cookTime": 30,
    "servings": 24,
    "difficulty": "Medium",
    "protein": "vegetarian",
    "seasons": [
      "all-year"
    ],
    "ingredients": [
      "1 cup rolled oats",
      "1 cup desiccated coconut",
      "1 cup flour",
      "1 cup sugar",
      "1/2 teaspoon salt",
      "200 g butter (Poppie recommends doubling this)",
      "2 tablespoons golden syrup",
      "1 teaspoon bicarbonate of soda (Poppie recommends doubling this)",
      "2 tablespoons boiling water"
    ],
    "instructions": [
      "Preheat the oven to 180 degrees C. Grease a baking tray.",
      "Mix the oats, coconut, flour, sugar and salt together in a large bowl.",
      "Melt the butter and golden syrup together in a saucepan over low heat.",
      "Dissolve the bicarbonate of soda in the boiling water and add to the butter mixture. It will foam up.",
      "Pour the wet mixture over the dry ingredients and mix well. You are looking for a sticky, slightly wet mix before cooking.",
      "Press into the greased baking tray and bake for about 25-30 minutes until golden.",
      "Leave to cool down in the pan for 10 minutes, then turn out and leave to cool for a further 10-12 minutes. Use a serrated knife to cut into squares or slices."
    ],
    "contributedBy": "The Kookbook",
    "story": "This is Barbara's recipe and she pretty much made them once a week. The first time I made them during lockdown they were superb, but the second time (as you'll recall) they became muesli. So, my feeling is that you double the amount of butter and the bicarb and water. Maybe even more, but what you are looking for is a sticky slightly wet mix before cooking. Good luck.",
    "tags": [
      "crunchies",
      "south-african",
      "oats",
      "baking",
      "bars",
      "barbara",
      "lockdown"
    ]
  },
  {
    "slug": "panna-cotta",
    "title": "Panna Cotta",
    "description": "A silky vanilla panna cotta topped with granadilla pulp. The backstory involves a Covid live-stream paella and a chef's secret ingredient.",
    "category": "desserts",
    "image": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fpanna-cotta%2Fopenart-image_1776291728617_9aadb474_1776291729235_ad3d41a9.jpg?alt=media&token=b67a07be-7161-4d30-a045-d991a2015b83",
    "images": [
      "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fpanna-cotta%2Fopenart-image_1776291728617_9aadb474_1776291729235_ad3d41a9.jpg?alt=media&token=b67a07be-7161-4d30-a045-d991a2015b83"
    ],
    "thumbUrl": "https://firebasestorage.googleapis.com/v0/b/a-fish-in-the-kitchen.firebasestorage.app/o/recipe-images%2Fpanna-cotta%2Fthumb-openart-image_1776291728617_9aadb474_1776291729235_ad3d41a9.jpg?alt=media&token=d68d3032-68ac-47b2-acde-368d64291cd2",
    "prepTime": 15,
    "cookTime": 10,
    "servings": 6,
    "difficulty": "Medium",
    "protein": "vegetarian",
    "ingredients": [
      "8 g gelatine powder",
      "25 ml water",
      "500 ml whipping cream",
      "60 g caster sugar",
      "1 vanilla pod, split lengthways",
      "Granadilla puree, to serve"
    ],
    "instructions": [
      "Add the gelatine to a bowl of cold water and soak for 5 minutes.",
      "Pour the cream into a saucepan on medium heat. Add the sugar and vanilla seeds (scrape the seeds out of the pod using the back of a knife). Stir to combine and bring to a simmer, then remove from the heat.",
      "Slightly warm the gelatine, then add to the cream mixture. Stir until completely dissolved.",
      "Pour into six ramekins and place in the fridge to set for at least a couple of hours.",
      "To serve, turn each ramekin upside-down onto a serving plate. If the panna cotta won't drop out, carefully dip the ramekin in a bowl of warm water to loosen it, or cut around the edges. Cover with granadilla pulp."
    ],
    "contributedBy": "The Kookbook",
    "story": "I'm sure I told you the back story to this one. David very kindly sent me a gift during Covid-19 of a paella. The ingredients arrived the day before and then we live streamed the cooking process with the chef. A bit like those MasterChef tests where you have to follow the chef, step by step. It wasn't bad as paellas go. But as an extra, they sent the ingredients for a Panna Cotta and G decided to make it. It didn't use double cream but rather a long-life cream (not even made of milk) called Meadowland. Meadowland, we discovered later, is a classic chef's trick -- you know the parts of the recipe that they will never tell you about. It's lighter than cream and not as rich but crucially, it never splits and we use it all the time for making peri peri chicken livers and de-boned peri-peri chicken on chips. Glorious stuff. You're going to have to do it the old fashioned way.",
    "tags": [
      "panna-cotta",
      "dessert",
      "italian",
      "vanilla",
      "granadilla",
      "set-dessert"
    ]
  }
];

export const SAMPLE_MEMBERS = [
  {
    name: "Gran (example)",
    title: "Head of Sunday Roasts",
    bio: "This is an example profile — tap Edit to make it a real family member, or delete it. Profiles let everyone see who's who, what they cook best, and which recipes are theirs.",
    goodAt: ["Roasts", "Baking"],
    loves: ["A full table", "Leftovers for breakfast"],
    hates: ["Soggy vegetables"],
    favouriteFromBook: "Bobotie",
    favouriteNotInBook: "Her secret trifle",
    order: 100,
  },
  {
    name: "Uncle Joe (example)",
    title: "Braai Master",
    bio: "Another example — edit or delete me. Add a profile for each family member so recipes can be credited to their cook (they don't need an account for that).",
    goodAt: ["Braai", "Marinades"],
    loves: ["Cooking over coals", "Sunday afternoons"],
    hates: ["Gas braais"],
    favouriteFromBook: "Chakalaka",
    favouriteNotInBook: "Boerewors rolls at the rugby",
    order: 101,
  },
];
