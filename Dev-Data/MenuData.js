// Simple Menu data
const menu_simple = {
  _id: ObjectId("65f1a2b3c4d5e6f7a8b9c0d1"),
  hotelId: ObjectId("65f1a2b3c4d5e6f7a8b9c0d0"),
  name: "Vanilla Bean",
  category: "Milk Shake & Ice Cream",
  description: "Classic creamy vanilla bean ice cream shake.",
  price: 75,
  veg: true,
  image:
    "https://images.unsplash.com/photo-1579954115545-a95591f28bfc?w=200&q=80",
  isAvailable: true,
  rating: 4.8,
  options: [], // Empty array since this item has no customizations
  createdAt: ISODate("2024-03-15T10:30:00.000Z"),
  updatedAt: ISODate("2024-03-15T10:30:00.000Z"),
};

// Example 2: Menu Item WITH Options (Customizable)

const menu2 = {
  _id: ObjectId("65f1a2b3c4d5e6f7a8b9c0d2"),
  hotelId: ObjectId("65f1a2b3c4d5e6f7a8b9c0d0"),
  name: "Classic Cheeseburger",
  category: "Fast Food",
  description: "Beef patty with melted cheddar, lettuce, and tomato.",
  price: 120,
  veg: false,
  image:
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200&q=80",
  isAvailable: true,
  rating: 4.7,
  options: [
    {
      name: "Size",
      required: true,
      choices: [
        { name: "Regular", priceMod: 0 },
        { name: "Large", priceMod: 40 },
        { name: "Extra Large", priceMod: 70 },
      ],
    },
    {
      name: "Add-ons",
      required: false,
      choices: [
        { name: "Extra Cheese", priceMod: 20 },
        { name: "Bacon Strip", priceMod: 35 },
        { name: "Fried Egg", priceMod: 25 },
      ],
    },
    {
      name: "Spiciness",
      required: true,
      choices: [
        { name: "Mild", priceMod: 0 },
        { name: "Medium", priceMod: 0 },
        { name: "Hot", priceMod: 0 },
        { name: "Extra Hot", priceMod: 5 },
      ],
    },
  ],
  createdAt: ISODate("2024-03-15T10:30:00.000Z"),
  updatedAt: ISODate("2024-03-15T10:30:00.000Z"),
};
