import mongoose, { Document, Schema, Types } from 'mongoose';
import { IUser } from './User';
import { IRoom } from './Room';

export interface IMessage extends Document {
  content: string;
  type: 'private' | 'group';
  sender: IUser['_id'];
  recipient?: IUser['_id'];
  room?: IRoom['_id'];
  reactions: Record<string, string>;
  readBy: Types.ObjectId[];
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    content: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['private', 'group'],
      required: true
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room'
    },
    reactions: {
      type: Map,
      of: String,
      default: {}
    },
    readBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }],
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent'
    }
  },
  {
    timestamps: true
  }
);

export const Message = mongoose.model<IMessage>('Message', messageSchema); 