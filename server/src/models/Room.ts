import mongoose, { Document, Schema } from 'mongoose';
import { IUser } from './User';
import { IMessage } from './Message';

export interface IRoom extends Document {
  name: string;
  creator: IUser['_id'];
  members: IUser['_id'][];
  lastMessage?: IMessage['_id'];
  isDirect: boolean;
  inviteCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    members: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    isDirect: {
      type: Boolean,
      default: false
    },
    inviteCode: {
      type: String,
      unique: true,
      sparse: true
    }
  },
  {
    timestamps: true
  }
);

export const Room = mongoose.model<IRoom>('Room', roomSchema); 