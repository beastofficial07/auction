const mongoose = require('mongoose');
const Auction = require('./models/Auction');
const Player = require('./models/Player');

mongoose.connect(process.env.MONGODB_URI).then(async () => {

  const organizerId = "69d2687102661188bc0ff3bc"; // ✅ YOUR ID

  // create auction
  const auction = await Auction.create({
    name: "IPL Auction",
    date: new Date(),
    organizerId: organizerId
  });

  // create players
  await Player.create([
    {
      name: "MS Dhoni",
      role: "Wicket Keeper",
      basePrice: 2000000,
      auctionId: auction._id
    },
    {
      name: "Virat Kohli",
      role: "Batsman",
      basePrice: 2000000,
      auctionId: auction._id
    }
  ]);

  console.log("✅ Data inserted");
  process.exit();
});
