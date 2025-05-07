import mongoose from 'mongoose';
import { config } from './index';

export const connectDB = async () => {
  try {
    const mongoURI = `mongodb://${config.database.host}:${config.database.port}/${config.database.database}`;
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}; 