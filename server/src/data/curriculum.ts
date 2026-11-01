/**
 * Grade 8 curriculum used for seeding and for the offline (no API key) tutor.
 * Every question is tagged with the specific concept it tests, which is what lets
 * the gap engine say "you struggle with *adding unlike denominators*" rather than
 * just "fractions".
 */

export type Diff = "easy" | "medium" | "hard";
export type Q = [concept: string, difficulty: Diff, prompt: string, options: string[], correct: number, explanation: string];

export type TopicSeed = {
  slug: string;
  name: string;
  description: string;
  lesson: {
    title: string;
    summary: string;
    content: string;
    keyPoints: string[];
    example: string;
    durationMinutes: number;
  };
  /** Short beginner summary in Hindi, Punjabi and Telugu for the multilingual offline tutor. */
  i18n: { hi: string; pa: string; te: string };
  questions: Q[];
};

export type SubjectSeed = {
  slug: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  topics: TopicSeed[];
};

export const curriculum: SubjectSeed[] = [
  {
    slug: "mathematics",
    name: "Mathematics",
    description: "Number sense, algebra, percentages and geometry for Grade 8.",
    color: "indigo",
    icon: "Calculator",
    topics: [
      {
        slug: "fractions",
        name: "Fractions",
        description: "Equivalent fractions and the four operations on fractions.",
        lesson: {
          title: "Working Confidently with Fractions",
          summary: "Learn why denominators must match before adding, and how multiplying and dividing fractions really work.",
          content: `A fraction describes part of a whole. The bottom number (denominator) tells you how many equal parts the whole is split into; the top number (numerator) tells you how many of those parts you have.

## Equivalent fractions
Multiplying or dividing the numerator and denominator by the same number gives an equal fraction: 1/2 = 2/4 = 3/6. Simplify by dividing both by their greatest common factor.

## Adding and subtracting
You can only add parts of the same size. First rewrite both fractions with a common denominator (the least common multiple of the denominators), then add the numerators. Never add the denominators.

## Multiplying
Multiply numerators together and denominators together: 2/3 × 3/4 = 6/12 = 1/2.

## Dividing
Keep the first fraction, change ÷ to ×, and flip the second fraction (use its reciprocal): 1/2 ÷ 1/4 = 1/2 × 4/1 = 2.`,
          keyPoints: [
            "Equivalent fractions: multiply or divide top and bottom by the same number.",
            "To add or subtract, make the denominators equal first — never add denominators.",
            "To multiply, multiply straight across.",
            "To divide, multiply by the reciprocal of the second fraction.",
          ],
          example: "1/3 + 1/4: the LCM of 3 and 4 is 12, so 1/3 = 4/12 and 1/4 = 3/12. 4/12 + 3/12 = 7/12.",
          durationMinutes: 12,
        },
        i18n: {
          hi: "भिन्न किसी पूरे का एक हिस्सा बताती है। जोड़ने से पहले हर (नीचे की संख्या) को बराबर करें, फिर केवल अंश (ऊपर की संख्या) जोड़ें — हर को कभी न जोड़ें।",
          pa: "ਭਿੰਨ ਕਿਸੇ ਪੂਰੇ ਦਾ ਇੱਕ ਹਿੱਸਾ ਦੱਸਦੀ ਹੈ। ਜੋੜਨ ਤੋਂ ਪਹਿਲਾਂ ਹੇਠਲੀਆਂ ਸੰਖਿਆਵਾਂ (ਹਰ) ਬਰਾਬਰ ਕਰੋ, ਫਿਰ ਸਿਰਫ਼ ਉੱਪਰਲੀਆਂ ਸੰਖਿਆਵਾਂ (ਅੰਸ਼) ਜੋੜੋ।",
          te: "భిన్నం ఒక మొత్తంలో ఒక భాగాన్ని సూచిస్తుంది. కూడే ముందు హారాలను (కింది సంఖ్యలు) సమానం చేయండి, తర్వాత లవాలను (పై సంఖ్యలు) మాత్రమే కూడండి — హారాలను ఎప్పుడూ కూడకండి.",
        },
        questions: [
          ["Equivalent fractions", "easy", "Which fraction is equivalent to 2/3?", ["4/9", "4/6", "3/2", "2/6"], 1, "Multiply top and bottom by 2: 2×2 / 3×2 = 4/6."],
          ["Equivalent fractions", "medium", "What is 18/24 in its simplest form?", ["9/12", "6/8", "3/4", "2/3"], 2, "The greatest common factor of 18 and 24 is 6. 18÷6 = 3 and 24÷6 = 4, so 3/4."],
          ["Adding unlike denominators", "easy", "What is 1/2 + 1/4?", ["2/6", "3/4", "1/6", "2/4"], 1, "1/2 = 2/4, so 2/4 + 1/4 = 3/4. Denominators are made equal, not added."],
          ["Adding unlike denominators", "medium", "What is 2/3 + 1/5?", ["3/8", "13/15", "3/15", "11/15"], 1, "LCM of 3 and 5 is 15: 2/3 = 10/15 and 1/5 = 3/15. 10/15 + 3/15 = 13/15."],
          ["Multiplying fractions", "medium", "What is 3/4 × 2/5?", ["6/20 = 3/10", "5/9", "15/8", "6/9"], 0, "Multiply across: (3×2)/(4×5) = 6/20, which simplifies to 3/10."],
          ["Dividing fractions", "hard", "What is 3/4 ÷ 3/8?", ["9/32", "1/2", "2", "6/12"], 2, "Multiply by the reciprocal: 3/4 × 8/3 = 24/12 = 2."],
        ],
      },
      {
        slug: "linear-equations",
        name: "Linear Equations",
        description: "Solving one- and two-step equations and equations with variables on both sides.",
        lesson: {
          title: "Solving Linear Equations Step by Step",
          summary: "Treat an equation like a balance: whatever you do to one side, do to the other.",
          content: `An equation says two expressions are equal. Solving it means finding the value of the variable that makes it true.

## The balance rule
Whatever operation you perform on one side, perform on the other side too. This keeps the equation balanced.

## Undo in reverse order
For 3x + 5 = 20, the variable was multiplied by 3 and then 5 was added. Undo in reverse: subtract 5 (3x = 15), then divide by 3 (x = 5).

## Variables on both sides
Move all variable terms to one side and constants to the other. For 5x − 3 = 2x + 9: subtract 2x from both sides (3x − 3 = 9), add 3 (3x = 12), divide by 3 (x = 4).

## Check your answer
Substitute back: 5(4) − 3 = 17 and 2(4) + 9 = 17. Both sides match.`,
          keyPoints: [
            "Do the same thing to both sides.",
            "Undo operations in reverse order: addition/subtraction first, then multiplication/division.",
            "Collect variables on one side, numbers on the other.",
            "Always substitute your answer back to check it.",
          ],
          example: "2(x + 3) = 14 → expand: 2x + 6 = 14 → subtract 6: 2x = 8 → divide by 2: x = 4.",
          durationMinutes: 12,
        },
        i18n: {
          hi: "समीकरण एक तराज़ू की तरह है — एक तरफ जो करें, दूसरी तरफ भी वही करें। पहले जोड़/घटाव हटाएँ, फिर गुणा/भाग, और अंत में उत्तर रखकर जाँचें।",
          pa: "ਸਮੀਕਰਨ ਇੱਕ ਤੱਕੜੀ ਵਾਂਗ ਹੈ — ਇੱਕ ਪਾਸੇ ਜੋ ਕਰੋ, ਦੂਜੇ ਪਾਸੇ ਵੀ ਉਹੀ ਕਰੋ। ਪਹਿਲਾਂ ਜੋੜ/ਘਟਾਓ ਹਟਾਓ, ਫਿਰ ਗੁਣਾ/ਭਾਗ, ਅਤੇ ਅਖੀਰ ਵਿੱਚ ਜਵਾਬ ਰੱਖ ਕੇ ਜਾਂਚ ਕਰੋ।",
          te: "సమీకరణం ఒక త్రాసు లాంటిది — ఒక వైపు ఏమి చేస్తే, మరో వైపూ అదే చేయాలి. ముందు కూడిక/తీసివేత తొలగించండి, తర్వాత గుణకారం/భాగహారం, చివరగా సమాధానాన్ని పెట్టి సరిచూసుకోండి.",
        },
        questions: [
          ["One-step equations", "easy", "Solve: x + 7 = 15", ["x = 22", "x = 8", "x = 7", "x = −8"], 1, "Subtract 7 from both sides: x = 15 − 7 = 8."],
          ["Two-step equations", "easy", "Solve: 2x + 4 = 10", ["x = 7", "x = 3", "x = 2", "x = 14"], 1, "Subtract 4: 2x = 6. Divide by 2: x = 3."],
          ["Two-step equations", "medium", "Solve: 3x − 5 = 16", ["x = 7", "x = 11/3", "x = 3.67", "x = 21"], 0, "Add 5: 3x = 21. Divide by 3: x = 7."],
          ["Variables on both sides", "medium", "Solve: 5x − 3 = 2x + 9", ["x = 2", "x = 12", "x = 4", "x = 6"], 2, "Subtract 2x: 3x − 3 = 9. Add 3: 3x = 12. Divide by 3: x = 4."],
          ["Equations with brackets", "hard", "Solve: 4(x − 2) = 2(x + 3)", ["x = 1", "x = 7", "x = 5", "x = −1"], 1, "Expand: 4x − 8 = 2x + 6. Subtract 2x: 2x − 8 = 6. Add 8: 2x = 14, so x = 7."],
          ["Word problems", "hard", "A number doubled and then increased by 9 equals 35. What is the number?", ["13", "22", "17", "26"], 0, "Write 2n + 9 = 35. Subtract 9: 2n = 26. Divide by 2: n = 13."],
        ],
      },
      {
        slug: "percentages",
        name: "Percentages",
        description: "Finding percentages of amounts, percentage change and discounts.",
        lesson: {
          title: "Percentages in Everyday Life",
          summary: "A percentage is a fraction out of 100. Learn to find percentages, discounts and percentage change.",
          content: `"Per cent" means "out of 100". So 25% = 25/100 = 0.25.

## Percentage of an amount
Convert the percentage to a decimal and multiply: 20% of 150 = 0.20 × 150 = 30.

## Discounts and increases
A 15% discount on ₹400: the discount is 0.15 × 400 = ₹60, so the price is ₹340. Shortcut: pay 85% → 0.85 × 400 = ₹340.

## Percentage change
Percentage change = (change ÷ original) × 100. Always divide by the ORIGINAL value, not the new one. From 50 to 60: change = 10, so 10 ÷ 50 × 100 = 20% increase.`,
          keyPoints: [
            "Percent means 'out of 100'.",
            "x% of an amount = (x ÷ 100) × amount.",
            "Percentage change = change ÷ original × 100.",
            "A discount of d% means you pay (100 − d)%.",
          ],
          example: "A shirt costs ₹800 with 25% off. You pay 75% of ₹800 = 0.75 × 800 = ₹600.",
          durationMinutes: 10,
        },
        i18n: {
          hi: "प्रतिशत का अर्थ है 'सौ में से'। किसी राशि का x% निकालने के लिए x/100 से गुणा करें; प्रतिशत परिवर्तन हमेशा मूल मान से भाग देकर निकालें।",
          pa: "ਪ੍ਰਤੀਸ਼ਤ ਦਾ ਅਰਥ ਹੈ 'ਸੌ ਵਿੱਚੋਂ'। ਕਿਸੇ ਰਕਮ ਦਾ x% ਲੱਭਣ ਲਈ x/100 ਨਾਲ ਗੁਣਾ ਕਰੋ; ਪ੍ਰਤੀਸ਼ਤ ਬਦਲਾਅ ਹਮੇਸ਼ਾ ਮੂਲ ਮੁੱਲ ਨਾਲ ਭਾਗ ਕਰਕੇ ਲੱਭੋ।",
          te: "శాతం అంటే 'వందలో'. ఒక మొత్తంలో x% కనుగొనడానికి x/100 తో గుణించండి; శాత మార్పును ఎప్పుడూ అసలు విలువతో భాగించి కనుగొనండి.",
        },
        questions: [
          ["Percentage of an amount", "easy", "What is 10% of 250?", ["2.5", "25", "250", "10"], 1, "10% = 0.10, and 0.10 × 250 = 25."],
          ["Percentage of an amount", "medium", "What is 35% of 80?", ["28", "35", "45", "24"], 0, "0.35 × 80 = 28."],
          ["Converting percentages", "easy", "Which decimal equals 7%?", ["0.7", "7.0", "0.07", "0.007"], 2, "7% = 7/100 = 0.07."],
          ["Discounts", "medium", "A ₹600 bag has a 20% discount. What is the sale price?", ["₹580", "₹480", "₹120", "₹500"], 1, "Discount = 0.20 × 600 = ₹120. Sale price = 600 − 120 = ₹480."],
          ["Percentage change", "hard", "A price rises from ₹40 to ₹50. What is the percentage increase?", ["20%", "10%", "25%", "50%"], 2, "Change = 10. Divide by the original: 10 ÷ 40 = 0.25 = 25%."],
          ["Percentage change", "hard", "A town's population fell from 2,000 to 1,700. What is the percentage decrease?", ["15%", "30%", "17.6%", "3%"], 0, "Change = 300. 300 ÷ 2,000 = 0.15 = 15%. Divide by the original, not the new value."],
        ],
      },
      {
        slug: "geometry",
        name: "Geometry & Measurement",
        description: "Angles, area, perimeter and the Pythagorean theorem.",
        lesson: {
          title: "Shapes, Angles and Pythagoras",
          summary: "Angle facts, the difference between area and perimeter, and finding a missing side of a right triangle.",
          content: `## Angles
Angles in a triangle add up to 180°. Angles on a straight line add up to 180°. Angles around a point add up to 360°.

## Perimeter vs. area
Perimeter is the distance around a shape (units: cm). Area is the space inside it (units: cm²). For a rectangle: perimeter = 2(l + w), area = l × w. For a triangle: area = ½ × base × height.

## Pythagorean theorem
In a right-angled triangle, a² + b² = c², where c is the hypotenuse (the longest side, opposite the right angle). For legs 6 and 8: c² = 36 + 64 = 100, so c = 10.`,
          keyPoints: [
            "Triangle angles sum to 180°.",
            "Perimeter is around (cm); area is inside (cm²).",
            "Triangle area = ½ × base × height.",
            "Right triangle: a² + b² = c², with c the hypotenuse.",
          ],
          example: "A rectangle 7 cm by 3 cm: perimeter = 2(7 + 3) = 20 cm, area = 7 × 3 = 21 cm².",
          durationMinutes: 14,
        },
        i18n: {
          hi: "त्रिभुज के कोणों का योग 180° होता है। परिमाप आकृति के चारों ओर की दूरी है और क्षेत्रफल अंदर की जगह; समकोण त्रिभुज में a² + b² = c² होता है।",
          pa: "ਤਿਕੋਣ ਦੇ ਕੋਣਾਂ ਦਾ ਜੋੜ 180° ਹੁੰਦਾ ਹੈ। ਘੇਰਾ ਆਕ੍ਰਿਤੀ ਦੇ ਦੁਆਲੇ ਦੀ ਦੂਰੀ ਹੈ ਅਤੇ ਖੇਤਰਫਲ ਅੰਦਰਲੀ ਥਾਂ; ਸਮਕੋਣ ਤਿਕੋਣ ਵਿੱਚ a² + b² = c² ਹੁੰਦਾ ਹੈ।",
          te: "త్రిభుజంలోని కోణాల మొత్తం 180°. చుట్టుకొలత ఆకారం చుట్టూ ఉన్న దూరం, వైశాల్యం లోపలి స్థలం; లంబకోణ త్రిభుజంలో a² + b² = c².",
        },
        questions: [
          ["Angles in a triangle", "easy", "Two angles of a triangle are 50° and 60°. What is the third angle?", ["70°", "80°", "90°", "110°"], 0, "Angles sum to 180°: 180 − 50 − 60 = 70°."],
          ["Area vs perimeter", "easy", "What is the area of a rectangle 8 cm long and 5 cm wide?", ["26 cm", "13 cm²", "40 cm²", "40 cm"], 2, "Area = length × width = 8 × 5 = 40 cm². Area uses square units."],
          ["Area vs perimeter", "medium", "What is the perimeter of a square with area 49 cm²?", ["28 cm", "49 cm", "14 cm", "7 cm"], 0, "Side = √49 = 7 cm. Perimeter = 4 × 7 = 28 cm."],
          ["Triangle area", "medium", "A triangle has base 10 cm and height 6 cm. What is its area?", ["60 cm²", "16 cm²", "30 cm²", "32 cm²"], 2, "Area = ½ × base × height = ½ × 10 × 6 = 30 cm²."],
          ["Pythagorean theorem", "hard", "A right triangle has legs 6 cm and 8 cm. How long is the hypotenuse?", ["14 cm", "10 cm", "48 cm", "100 cm"], 1, "c² = 6² + 8² = 36 + 64 = 100, so c = √100 = 10 cm."],
          ["Pythagorean theorem", "hard", "The hypotenuse is 13 cm and one leg is 5 cm. How long is the other leg?", ["8 cm", "18 cm", "12 cm", "√194 cm"], 2, "b² = 13² − 5² = 169 − 25 = 144, so b = 12 cm. Subtract when finding a leg."],
        ],
      },
    ],
  },
  {
    slug: "science",
    name: "Science",
    description: "Cells, forces, matter and electricity for Grade 8.",
    color: "emerald",
    icon: "FlaskConical",
    topics: [
      {
        slug: "cells",
        name: "Cell Structure",
        description: "Organelles and the differences between plant and animal cells.",
        lesson: {
          title: "Inside the Cell",
          summary: "Every living thing is made of cells. Learn what each organelle does and how plant and animal cells differ.",
          content: `The cell is the basic unit of life.

## Key organelles
- Nucleus: the control centre; contains DNA.
- Cell membrane: controls what enters and leaves the cell.
- Cytoplasm: jelly-like fluid where most reactions happen.
- Mitochondria: release energy from food through respiration.
- Ribosomes: make proteins.

## Plant cells also have
- Cell wall: a rigid layer made of cellulose that supports the cell.
- Chloroplasts: contain chlorophyll and carry out photosynthesis.
- A large permanent vacuole: filled with cell sap; keeps the cell firm.

Animal cells have a membrane but no cell wall, and no chloroplasts.`,
          keyPoints: [
            "Nucleus controls the cell and holds DNA.",
            "Mitochondria release energy (respiration).",
            "Only plant cells have a cell wall, chloroplasts and a large vacuole.",
            "The membrane controls what enters and leaves.",
          ],
          example: "A leaf cell is green because its chloroplasts contain chlorophyll; a cheek cell has no chloroplasts, so it is not green.",
          durationMinutes: 10,
        },
        i18n: {
          hi: "कोशिका जीवन की मूल इकाई है। केंद्रक कोशिका को नियंत्रित करता है, माइटोकॉन्ड्रिया ऊर्जा देते हैं, और केवल पादप कोशिकाओं में कोशिका भित्ति व हरितलवक होते हैं।",
          pa: "ਸੈੱਲ ਜੀਵਨ ਦੀ ਮੂਲ ਇਕਾਈ ਹੈ। ਨਿਊਕਲੀਅਸ ਸੈੱਲ ਨੂੰ ਕੰਟਰੋਲ ਕਰਦਾ ਹੈ, ਮਾਈਟੋਕਾਂਡਰੀਆ ਊਰਜਾ ਦਿੰਦੇ ਹਨ, ਅਤੇ ਸਿਰਫ਼ ਪੌਦਿਆਂ ਦੇ ਸੈੱਲਾਂ ਵਿੱਚ ਸੈੱਲ ਕੰਧ ਤੇ ਕਲੋਰੋਪਲਾਸਟ ਹੁੰਦੇ ਹਨ।",
          te: "కణం జీవానికి ప్రాథమిక ప్రమాణం. కేంద్రకం కణాన్ని నియంత్రిస్తుంది, మైటోకాండ్రియా శక్తిని ఇస్తాయి, మొక్క కణాలలో మాత్రమే కణ కవచం మరియు హరితరేణువులు ఉంటాయి.",
        },
        questions: [
          ["Organelle functions", "easy", "Which organelle contains the cell's DNA?", ["Ribosome", "Nucleus", "Vacuole", "Cell wall"], 1, "The nucleus is the control centre and holds the genetic material (DNA)."],
          ["Organelle functions", "medium", "Which organelle releases energy from glucose?", ["Chloroplast", "Ribosome", "Mitochondrion", "Nucleus"], 2, "Mitochondria carry out respiration, releasing energy from glucose."],
          ["Plant vs animal cells", "easy", "Which structure is found in plant cells but NOT animal cells?", ["Cell membrane", "Cytoplasm", "Nucleus", "Cell wall"], 3, "Only plant cells have a rigid cellulose cell wall. Both have a membrane, cytoplasm and nucleus."],
          ["Plant vs animal cells", "medium", "Why are root cells of a plant usually not green?", ["They have no nucleus", "They lack chloroplasts", "They have no cell wall", "They lack mitochondria"], 1, "Roots get no light, so their cells have no chloroplasts and therefore no green chlorophyll."],
          ["Cell membrane", "medium", "What is the main job of the cell membrane?", ["Make proteins", "Control what enters and leaves the cell", "Photosynthesis", "Store DNA"], 1, "The membrane is selectively permeable: it controls the movement of substances in and out."],
          ["Organelle functions", "hard", "A cell that makes large amounts of enzymes (proteins) would have many…", ["Vacuoles", "Chloroplasts", "Ribosomes", "Cell walls"], 2, "Ribosomes are where proteins, including enzymes, are made."],
        ],
      },
      {
        slug: "force-motion",
        name: "Force & Motion",
        description: "Speed, Newton's laws and friction.",
        lesson: {
          title: "Forces and How Things Move",
          summary: "Calculate speed, understand Newton's three laws, and see how friction affects motion.",
          content: `## Speed
Speed = distance ÷ time. A car that travels 120 km in 2 hours has an average speed of 60 km/h.

## Newton's laws
1. An object stays at rest or keeps moving at a constant speed in a straight line unless an unbalanced force acts on it.
2. Force = mass × acceleration (F = m × a). A bigger force gives a bigger acceleration; a bigger mass gives a smaller one.
3. Every action has an equal and opposite reaction.

## Friction
Friction is a force that opposes motion between surfaces in contact. It produces heat and slows things down. Rough surfaces produce more friction; lubricants reduce it.`,
          keyPoints: [
            "Speed = distance ÷ time.",
            "Balanced forces → no change in motion.",
            "F = m × a.",
            "Friction always opposes motion.",
          ],
          example: "A 2 kg ball pushed with a 10 N force accelerates at a = F ÷ m = 10 ÷ 2 = 5 m/s².",
          durationMinutes: 12,
        },
        i18n: {
          hi: "चाल = दूरी ÷ समय। न्यूटन का दूसरा नियम कहता है बल = द्रव्यमान × त्वरण, और घर्षण हमेशा गति का विरोध करता है।",
          pa: "ਰਫ਼ਤਾਰ = ਦੂਰੀ ÷ ਸਮਾਂ। ਨਿਊਟਨ ਦਾ ਦੂਜਾ ਨਿਯਮ ਕਹਿੰਦਾ ਹੈ ਬਲ = ਪੁੰਜ × ਪ੍ਰਵੇਗ, ਅਤੇ ਰਗੜ ਹਮੇਸ਼ਾ ਗਤੀ ਦਾ ਵਿਰੋਧ ਕਰਦੀ ਹੈ।",
          te: "వేగం = దూరం ÷ కాలం. న్యూటన్ రెండవ నియమం ప్రకారం బలం = ద్రవ్యరాశి × త్వరణం, ఘర్షణ ఎల్లప్పుడూ చలనాన్ని వ్యతిరేకిస్తుంది.",
        },
        questions: [
          ["Speed calculations", "easy", "A cyclist travels 30 km in 2 hours. What is the average speed?", ["60 km/h", "15 km/h", "32 km/h", "28 km/h"], 1, "Speed = distance ÷ time = 30 ÷ 2 = 15 km/h."],
          ["Speed calculations", "medium", "How long does it take to travel 150 km at 50 km/h?", ["3 hours", "2 hours", "7,500 hours", "100 hours"], 0, "Time = distance ÷ speed = 150 ÷ 50 = 3 hours."],
          ["Newton's laws", "medium", "A 4 kg object accelerates at 3 m/s². What net force acts on it?", ["7 N", "1.33 N", "12 N", "0.75 N"], 2, "F = m × a = 4 × 3 = 12 N."],
          ["Newton's laws", "hard", "A book rests on a table. Which statement is correct?", ["No forces act on it", "Gravity is balanced by the table's upward push", "Gravity is greater than the table's push", "Only the table's push acts on it"], 1, "The book is at rest, so the forces are balanced: weight down equals the normal force up (Newton's first law)."],
          ["Friction", "easy", "In which direction does friction act on a sliding box?", ["Same direction as motion", "Opposite to the motion", "Straight up", "It has no direction"], 1, "Friction always opposes motion, acting opposite to the direction of sliding."],
          ["Newton's laws", "hard", "When a swimmer pushes water backwards, they move forwards. This illustrates…", ["Newton's first law", "Newton's second law", "Newton's third law", "Friction"], 2, "Action (push water back) and reaction (water pushes swimmer forward) are equal and opposite — Newton's third law."],
        ],
      },
      {
        slug: "matter",
        name: "Matter & Its Changes",
        description: "States of matter, particle model, and physical versus chemical change.",
        lesson: {
          title: "Particles, States and Changes",
          summary: "Use the particle model to explain solids, liquids and gases, and tell physical changes from chemical ones.",
          content: `## The particle model
- Solids: particles packed tightly in a fixed pattern; they vibrate in place. Fixed shape and volume.
- Liquids: particles close together but can slide past each other. Fixed volume, takes the shape of its container.
- Gases: particles far apart and moving fast in all directions. No fixed shape or volume.

## Changes of state
Melting (solid → liquid), freezing (liquid → solid), evaporation/boiling (liquid → gas), condensation (gas → liquid). Heating gives particles more energy.

## Physical vs chemical change
A physical change alters form but makes no new substance and is usually reversible (melting ice, dissolving sugar). A chemical change makes a new substance and is hard to reverse (burning paper, rusting iron). Signs: gas given off, colour change, heat or light released.`,
          keyPoints: [
            "Solids vibrate in place; liquids flow; gases spread out.",
            "Changes of state are physical changes.",
            "Chemical changes produce new substances.",
            "Signs of a chemical change: gas, colour change, heat/light.",
          ],
          example: "Ice melting is physical (still water). Iron rusting is chemical (iron oxide, a new substance, forms).",
          durationMinutes: 11,
        },
        i18n: {
          hi: "ठोस में कण पास-पास कसे होते हैं, द्रव में खिसक सकते हैं और गैस में दूर-दूर तेज़ी से घूमते हैं। भौतिक परिवर्तन में नया पदार्थ नहीं बनता, जबकि रासायनिक परिवर्तन में नया पदार्थ बनता है।",
          pa: "ਠੋਸ ਵਿੱਚ ਕਣ ਨੇੜੇ-ਨੇੜੇ ਕੱਸੇ ਹੁੰਦੇ ਹਨ, ਤਰਲ ਵਿੱਚ ਖਿਸਕ ਸਕਦੇ ਹਨ ਅਤੇ ਗੈਸ ਵਿੱਚ ਦੂਰ-ਦੂਰ ਤੇਜ਼ੀ ਨਾਲ ਘੁੰਮਦੇ ਹਨ। ਭੌਤਿਕ ਤਬਦੀਲੀ ਵਿੱਚ ਨਵਾਂ ਪਦਾਰਥ ਨਹੀਂ ਬਣਦਾ, ਰਸਾਇਣਕ ਤਬਦੀਲੀ ਵਿੱਚ ਬਣਦਾ ਹੈ।",
          te: "ఘనపదార్థంలో కణాలు దగ్గరగా బిగుతుగా ఉంటాయి, ద్రవంలో జారగలవు, వాయువులో దూరంగా వేగంగా కదులుతాయి. భౌతిక మార్పులో కొత్త పదార్థం ఏర్పడదు, రసాయన మార్పులో కొత్త పదార్థం ఏర్పడుతుంది.",
        },
        questions: [
          ["States of matter", "easy", "In which state are particles furthest apart?", ["Solid", "Liquid", "Gas", "They are equally spaced"], 2, "Gas particles are far apart and move quickly in all directions."],
          ["States of matter", "medium", "Why can a liquid be poured but a solid cannot?", ["Liquid particles have no mass", "Liquid particles can slide past each other", "Liquid particles are far apart", "Solids have no particles"], 1, "In a liquid, particles are close but free to move past one another, so it flows."],
          ["Changes of state", "easy", "Water vapour turning into droplets on a cold window is called…", ["Evaporation", "Melting", "Condensation", "Sublimation"], 2, "Gas turning to liquid is condensation."],
          ["Physical vs chemical change", "medium", "Which is a chemical change?", ["Ice melting", "Sugar dissolving in tea", "Paper burning", "Glass breaking"], 2, "Burning produces new substances (ash, carbon dioxide) and cannot be reversed — a chemical change."],
          ["Physical vs chemical change", "hard", "Which observation best shows a chemical change has happened?", ["The substance changed shape", "A gas was produced and the colour changed", "The substance melted", "The substance was cut into pieces"], 1, "Gas production and colour change are signs that a new substance has formed."],
          ["Changes of state", "hard", "During boiling, the temperature of pure water stays at 100 °C even though heat is added. Where does the energy go?", ["It is destroyed", "Into breaking the forces between particles", "Into making the particles heavier", "Into cooling the pan"], 1, "The energy is used to overcome attractions between particles so they can escape as gas, not to raise temperature."],
        ],
      },
      {
        slug: "electricity",
        name: "Electricity",
        description: "Circuits, current, voltage, resistance and Ohm's law.",
        lesson: {
          title: "Electric Circuits Made Simple",
          summary: "Understand current, voltage and resistance, and how series and parallel circuits behave.",
          content: `## Key quantities
- Current (I), in amperes (A): the flow of charge.
- Voltage (V), in volts (V): the "push" that drives the current.
- Resistance (R), in ohms (Ω): how much a component opposes the current.

## Ohm's law
V = I × R. So I = V ÷ R and R = V ÷ I. A 12 V battery across a 4 Ω resistor gives I = 12 ÷ 4 = 3 A.

## Series vs parallel
- Series: one path. The same current flows through every component. If one bulb breaks, all go out.
- Parallel: several paths. Each branch gets the full voltage. If one bulb breaks, the others stay lit. This is how homes are wired.`,
          keyPoints: [
            "Current = flow, voltage = push, resistance = opposition.",
            "V = I × R.",
            "Series: one path, same current everywhere.",
            "Parallel: many paths, components work independently.",
          ],
          example: "A torch bulb has 6 Ω resistance and is powered by 3 V. Current = 3 ÷ 6 = 0.5 A.",
          durationMinutes: 12,
        },
        i18n: {
          hi: "धारा आवेश का प्रवाह है, वोल्टेज उसे धकेलता है और प्रतिरोध उसका विरोध करता है। ओम का नियम: V = I × R; श्रेणी परिपथ में एक रास्ता होता है, समांतर में कई।",
          pa: "ਕਰੰਟ ਚਾਰਜ ਦਾ ਵਹਾਅ ਹੈ, ਵੋਲਟੇਜ ਉਸਨੂੰ ਧੱਕਦੀ ਹੈ ਅਤੇ ਰੋਧ ਉਸਦਾ ਵਿਰੋਧ ਕਰਦਾ ਹੈ। ਓਹਮ ਦਾ ਨਿਯਮ: V = I × R; ਲੜੀਵਾਰ ਸਰਕਟ ਵਿੱਚ ਇੱਕ ਰਸਤਾ, ਸਮਾਂਤਰ ਵਿੱਚ ਕਈ।",
          te: "విద్యుత్ ప్రవాహం ఆవేశం యొక్క ప్రవాహం, వోల్టేజ్ దాన్ని నెడుతుంది, నిరోధం దాన్ని వ్యతిరేకిస్తుంది. ఓమ్ నియమం: V = I × R; శ్రేణి వలయంలో ఒకే మార్గం, సమాంతర వలయంలో అనేక మార్గాలు.",
        },
        questions: [
          ["Circuit quantities", "easy", "What is the unit of electrical resistance?", ["Ampere", "Volt", "Ohm", "Watt"], 2, "Resistance is measured in ohms (Ω)."],
          ["Ohm's law", "medium", "A 9 V battery is connected to a 3 Ω resistor. What is the current?", ["27 A", "3 A", "12 A", "0.33 A"], 1, "I = V ÷ R = 9 ÷ 3 = 3 A."],
          ["Ohm's law", "hard", "A current of 2 A flows through a 5 Ω resistor. What is the voltage across it?", ["2.5 V", "7 V", "10 V", "0.4 V"], 2, "V = I × R = 2 × 5 = 10 V."],
          ["Series and parallel", "easy", "In a series circuit, if one bulb breaks, the others…", ["Get brighter", "Stay on", "Go out", "Flicker"], 2, "A series circuit has only one path; a break stops the current everywhere."],
          ["Series and parallel", "medium", "Why are homes wired in parallel?", ["It uses less wire", "Each appliance can be switched on and off independently", "It increases resistance", "The current is the same everywhere"], 1, "Parallel branches are independent, and each gets the full mains voltage."],
          ["Circuit quantities", "hard", "If the voltage across a fixed resistor is doubled, the current…", ["Halves", "Stays the same", "Doubles", "Becomes zero"], 2, "With R fixed, I = V ÷ R, so doubling V doubles I."],
        ],
      },
    ],
  },
  {
    slug: "english",
    name: "English",
    description: "Grammar, vocabulary and writing mechanics for Grade 8.",
    color: "violet",
    icon: "BookOpenText",
    topics: [
      {
        slug: "tenses",
        name: "Verb Tenses",
        description: "Simple, continuous and perfect tenses in past, present and future.",
        lesson: {
          title: "Getting Tenses Right",
          summary: "Choose the right tense by asking two questions: when did it happen, and is it finished?",
          content: `Tense tells us when an action happens.

## Simple tenses
- Present: She walks to school.
- Past: She walked to school.
- Future: She will walk to school.

## Continuous tenses (action in progress)
Use a form of "be" + verb-ing: She is walking / was walking / will be walking.

## Perfect tenses (completed, connected to another time)
Use a form of "have" + past participle: She has walked (up to now) / had walked (before another past event) / will have walked.

## Common clue words
- Yesterday, last week → simple past.
- Since, for, already, yet, just → present perfect.
- At this moment, now → present continuous.`,
          keyPoints: [
            "Continuous = be + -ing.",
            "Perfect = have + past participle.",
            "'Since' and 'for' often signal the present perfect.",
            "Use the past perfect for the earlier of two past events.",
          ],
          example: "By the time we arrived, the film had started. (had started = earlier past event)",
          durationMinutes: 10,
        },
        i18n: {
          hi: "काल बताता है कि क्रिया कब होती है। चल रही क्रिया के लिए be + -ing और पूरी हुई क्रिया के लिए have + past participle का प्रयोग करें।",
          pa: "ਕਾਲ ਦੱਸਦਾ ਹੈ ਕਿ ਕਿਰਿਆ ਕਦੋਂ ਹੁੰਦੀ ਹੈ। ਚੱਲ ਰਹੀ ਕਿਰਿਆ ਲਈ be + -ing ਅਤੇ ਪੂਰੀ ਹੋਈ ਕਿਰਿਆ ਲਈ have + past participle ਵਰਤੋ।",
          te: "కాలం ఒక పని ఎప్పుడు జరుగుతుందో చెబుతుంది. జరుగుతున్న పనికి be + -ing, పూర్తయిన పనికి have + past participle ఉపయోగించండి.",
        },
        questions: [
          ["Simple past", "easy", "Choose the correct verb: Yesterday, we ___ to the museum.", ["go", "goes", "went", "have gone"], 2, "'Yesterday' points to a finished time in the past, so use the simple past: went."],
          ["Present continuous", "easy", "Choose the correct verb: Listen! The baby ___.", ["cries", "is crying", "cried", "has cried"], 1, "'Listen!' shows the action is happening now — present continuous: is crying."],
          ["Present perfect", "medium", "Choose the correct verb: I ___ here since 2020.", ["live", "am living", "have lived", "lived"], 2, "'Since 2020' links the past to now, so use the present perfect: have lived."],
          ["Past perfect", "hard", "Choose the correct verb: When I reached the station, the train ___.", ["already left", "has already left", "had already left", "is leaving"], 2, "The train left before I reached — the earlier past event takes the past perfect: had already left."],
          ["Future forms", "medium", "Choose the correct sentence.", ["She will finishes it tomorrow.", "She will finish it tomorrow.", "She will finished it tomorrow.", "She finish it tomorrow."], 1, "After 'will', use the base form of the verb: will finish."],
          ["Present perfect", "hard", "Which sentence is correct?", ["I have seen that film last week.", "I saw that film last week.", "I have saw that film last week.", "I seen that film last week."], 1, "A specific finished time ('last week') needs the simple past, not the present perfect."],
        ],
      },
      {
        slug: "parts-of-speech",
        name: "Parts of Speech",
        description: "Nouns, verbs, adjectives, adverbs, pronouns and prepositions.",
        lesson: {
          title: "The Jobs Words Do",
          summary: "Identify a word's part of speech by looking at the job it does in the sentence.",
          content: `A word's part of speech depends on how it is used in a sentence.

- Noun: names a person, place, thing or idea (girl, Delhi, honesty).
- Pronoun: replaces a noun (she, they, it).
- Verb: shows an action or state (run, is, seem).
- Adjective: describes a noun (tall, blue, three).
- Adverb: describes a verb, adjective or another adverb; often ends in -ly (quickly, very, often).
- Preposition: shows position or relationship (on, under, between, during).
- Conjunction: joins words or clauses (and, but, because).

## Same word, different jobs
"Fast" can be an adjective (a fast car) or an adverb (she runs fast). Always check what the word is describing.`,
          keyPoints: [
            "Adjectives describe nouns; adverbs describe verbs, adjectives or adverbs.",
            "Not all adverbs end in -ly (fast, well, very).",
            "The job in the sentence decides the part of speech.",
            "Prepositions show relationships like place and time.",
          ],
          example: "In 'The very tired dog slept peacefully under the tree', very = adverb, tired = adjective, slept = verb, peacefully = adverb, under = preposition.",
          durationMinutes: 9,
        },
        i18n: {
          hi: "शब्द का भेद इस बात से तय होता है कि वाक्य में वह क्या काम कर रहा है। विशेषण संज्ञा का वर्णन करता है, जबकि क्रिया-विशेषण क्रिया, विशेषण या दूसरे क्रिया-विशेषण का।",
          pa: "ਸ਼ਬਦ ਦੀ ਕਿਸਮ ਇਸ ਗੱਲ ਤੋਂ ਤੈਅ ਹੁੰਦੀ ਹੈ ਕਿ ਵਾਕ ਵਿੱਚ ਉਹ ਕੀ ਕੰਮ ਕਰ ਰਿਹਾ ਹੈ। ਵਿਸ਼ੇਸ਼ਣ ਨਾਂਵ ਦਾ ਵਰਣਨ ਕਰਦਾ ਹੈ, ਕਿਰਿਆ-ਵਿਸ਼ੇਸ਼ਣ ਕਿਰਿਆ ਜਾਂ ਵਿਸ਼ੇਸ਼ਣ ਦਾ।",
          te: "ఒక పదం వాక్యంలో చేసే పనిని బట్టి దాని భాషాభాగం నిర్ణయమవుతుంది. విశేషణం నామవాచకాన్ని వర్ణిస్తుంది, క్రియా విశేషణం క్రియను లేదా విశేషణాన్ని వర్ణిస్తుంది.",
        },
        questions: [
          ["Nouns and pronouns", "easy", "Which word is a pronoun? 'Ravi lost his keys, so he searched everywhere.'", ["Ravi", "keys", "he", "searched"], 2, "'He' replaces the noun Ravi, so it is a pronoun."],
          ["Adjectives vs adverbs", "easy", "Which word is an adjective? 'The clever fox escaped quickly.'", ["clever", "fox", "escaped", "quickly"], 0, "'Clever' describes the noun fox, so it is an adjective."],
          ["Adjectives vs adverbs", "medium", "In 'She sings beautifully', what part of speech is 'beautifully'?", ["Adjective", "Adverb", "Noun", "Verb"], 1, "'Beautifully' describes how she sings (a verb), so it is an adverb."],
          ["Prepositions", "medium", "Which word is a preposition? 'The cat hid under the old table.'", ["cat", "hid", "under", "old"], 2, "'Under' shows the position of the cat relative to the table."],
          ["Adjectives vs adverbs", "hard", "In 'He drives a fast car' and 'He drives fast', the word 'fast' is…", ["An adverb both times", "An adjective, then an adverb", "An adverb, then an adjective", "An adjective both times"], 1, "First it describes the noun car (adjective); then it describes how he drives (adverb)."],
          ["Abstract nouns", "hard", "Which of these is an abstract noun?", ["Teacher", "Courage", "Mountain", "Pencil"], 1, "An abstract noun names an idea or quality you cannot touch — courage."],
        ],
      },
      {
        slug: "punctuation",
        name: "Punctuation",
        description: "Commas, apostrophes, quotation marks and end punctuation.",
        lesson: {
          title: "Punctuation That Makes Meaning Clear",
          summary: "Master apostrophes, commas and speech marks — the punctuation students mix up most often.",
          content: `## Apostrophes
- Possession: the girl's bag (one girl), the girls' bags (more than one girl).
- Contractions: it's = it is; don't = do not.
- "Its" (no apostrophe) means belonging to it: The dog wagged its tail.

## Commas
- Separate items in a list: apples, mangoes and bananas.
- After an introductory phrase: After lunch, we played cricket.
- Before a joining word linking two full sentences: I was tired, but I finished my homework.

## Speech marks
Put the spoken words and their punctuation inside the marks: "Where are you going?" asked Meera.`,
          keyPoints: [
            "it's = it is; its = belonging to it.",
            "Plural possessive: put the apostrophe after the s (the students' books).",
            "Use a comma after an introductory phrase.",
            "Punctuation of spoken words goes inside the speech marks.",
          ],
          example: "It's raining, so the cat is licking its paws. (It's = it is; its = belonging to the cat)",
          durationMinutes: 9,
        },
        i18n: {
          hi: "it's का अर्थ है it is, जबकि its का अर्थ है 'उसका'। सूची के शब्दों के बीच और शुरुआती वाक्यांश के बाद अल्पविराम (comma) लगाएँ।",
          pa: "it's ਦਾ ਅਰਥ ਹੈ it is, ਜਦਕਿ its ਦਾ ਅਰਥ ਹੈ 'ਉਸਦਾ'। ਸੂਚੀ ਦੇ ਸ਼ਬਦਾਂ ਵਿਚਕਾਰ ਅਤੇ ਸ਼ੁਰੂਆਤੀ ਵਾਕੰਸ਼ ਤੋਂ ਬਾਅਦ ਕਾਮਾ ਲਗਾਓ।",
          te: "it's అంటే it is, its అంటే 'దాని'. జాబితాలోని పదాల మధ్య మరియు ప్రారంభ పదబంధం తర్వాత కామా పెట్టండి.",
        },
        questions: [
          ["Apostrophes", "easy", "Which is correct?", ["The dog wagged it's tail.", "The dog wagged its tail.", "The dog wagged its' tail.", "The dog wagged it is tail."], 1, "'Its' (no apostrophe) shows possession. 'It's' always means 'it is'."],
          ["Apostrophes", "medium", "Which phrase correctly shows books belonging to several students?", ["the student's books", "the students books", "the students' books", "the student's' books"], 2, "For a plural noun ending in s, put the apostrophe after the s: students'."],
          ["Commas", "easy", "Where does the comma belong? 'After the match we ate dinner.'", ["After the, match", "After the match, we ate dinner.", "After, the match we ate dinner.", "After the match we, ate dinner."], 1, "Place a comma after an introductory phrase: 'After the match,'."],
          ["Commas", "medium", "Which sentence is punctuated correctly?", ["I was tired but, I finished.", "I was tired, but I finished.", "I was, tired but I finished.", "I was tired but I, finished."], 1, "Put the comma before 'but' when it joins two complete sentences."],
          ["Speech marks", "hard", "Which sentence is punctuated correctly?", ["\"Are you coming\"? asked Sita.", "\"Are you coming?\" asked Sita.", "\"Are you coming\" asked Sita?", "Are you coming? \"asked Sita.\""], 1, "The question mark belongs to the spoken words, so it goes inside the speech marks."],
          ["Apostrophes", "hard", "Which sentence uses apostrophes correctly?", ["The children's toys are in the box.", "The childrens' toys are in the box.", "The childrens toys are in the box.", "The children's' toys are in the box."], 0, "'Children' is already plural without an s, so add 's: children's."],
        ],
      },
      {
        slug: "voice",
        name: "Active & Passive Voice",
        description: "Recognising and converting between active and passive voice.",
        lesson: {
          title: "Active and Passive Voice",
          summary: "Learn who is doing the action, and how to move the doer to the end of the sentence.",
          content: `## Active voice
The subject does the action: The chef cooked the meal.

## Passive voice
The subject receives the action: The meal was cooked by the chef.

## How to convert active → passive
1. Move the object to the front (the meal).
2. Use the correct form of "be" in the same tense as the original verb (was).
3. Add the past participle of the main verb (cooked).
4. Optionally add "by" + the doer (by the chef).

## Tense must match
- Present: The letter is written by Asha.
- Past: The letter was written by Asha.
- Future: The letter will be written by Asha.
- Present perfect: The letter has been written by Asha.`,
          keyPoints: [
            "Active: doer first. Passive: receiver first.",
            "Passive = form of 'be' + past participle.",
            "Keep the same tense when converting.",
            "'by + doer' is optional in the passive.",
          ],
          example: "Active: The students will plant trees. → Passive: Trees will be planted by the students.",
          durationMinutes: 10,
        },
        i18n: {
          hi: "कर्तृवाच्य में कर्ता क्रिया करता है; कर्मवाच्य में कर्म आगे आता है। कर्मवाच्य = 'be' का सही रूप + past participle, और काल वही रहता है।",
          pa: "ਕਰਤਰੀ ਵਾਚ ਵਿੱਚ ਕਰਤਾ ਕਿਰਿਆ ਕਰਦਾ ਹੈ; ਕਰਮਣੀ ਵਾਚ ਵਿੱਚ ਕਰਮ ਅੱਗੇ ਆਉਂਦਾ ਹੈ। ਕਰਮਣੀ ਵਾਚ = 'be' ਦਾ ਸਹੀ ਰੂਪ + past participle, ਅਤੇ ਕਾਲ ਉਹੀ ਰਹਿੰਦਾ ਹੈ।",
          te: "కర్తరి వాక్యంలో కర్త పని చేస్తాడు; కర్మణి వాక్యంలో కర్మ ముందుకు వస్తుంది. కర్మణి = 'be' సరైన రూపం + past participle, కాలం మారదు.",
        },
        questions: [
          ["Identifying voice", "easy", "Which sentence is in the passive voice?", ["The boy kicked the ball.", "The ball was kicked by the boy.", "The boy is kicking the ball.", "The boy will kick the ball."], 1, "The receiver (the ball) is the subject and the verb uses 'was' + past participle."],
          ["Identifying voice", "easy", "Which sentence is in the active voice?", ["The cake was eaten.", "The song was sung by Priya.", "Priya sang the song.", "The window has been broken."], 2, "Priya (the doer) is the subject performing the action."],
          ["Converting tenses", "medium", "Change to passive: 'The teacher checks the papers.'", ["The papers were checked by the teacher.", "The papers are checked by the teacher.", "The papers checked the teacher.", "The papers have checked by the teacher."], 1, "Present simple active → 'are' + past participle in the passive."],
          ["Converting tenses", "medium", "Change to passive: 'Ravi wrote a letter.'", ["A letter is written by Ravi.", "A letter was wrote by Ravi.", "A letter was written by Ravi.", "A letter has been written by Ravi."], 2, "Simple past → 'was' + past participle 'written'."],
          ["Converting tenses", "hard", "Change to passive: 'They will build a new bridge.'", ["A new bridge will built.", "A new bridge will be built by them.", "A new bridge is built by them.", "A new bridge would be build by them."], 1, "Future → 'will be' + past participle 'built'."],
          ["Converting tenses", "hard", "Change to passive: 'Someone has stolen my bike.'", ["My bike was stolen.", "My bike has been stolen.", "My bike had stolen.", "My bike is being stolen."], 1, "Present perfect → 'has been' + past participle. The vague doer 'someone' can be left out."],
        ],
      },
    ],
  },
];
