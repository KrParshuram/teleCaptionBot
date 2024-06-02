import mongoose from "mongoose";

export default () => {
    return mongoose.connect(process.env.DB_URL);
};