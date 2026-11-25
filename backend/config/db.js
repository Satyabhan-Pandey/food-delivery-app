import mongoose from "mongoose";

export const connectDB = async () => {
  await mongoose
    .connect(
      "mongodb+srv://namastereact48_db_user:FKMsVGUAGZ4BgJjt@cluster0.qz176es.mongodb.net/food-del",
    )
    .then(() => console.log("DB Connected"));
};
