import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("invite_redemptions")
export class InviteRedemptionEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column()
  codeId: string;

  @Column()
  inviterUserId: string;

  @Index({ unique: true })
  @Column()
  inviteeUserId: string;

  @Index()
  @Column()
  inviteePhone: string;

  @Index()
  @Column({ type: "text", nullable: true })
  inviteeIp: string | null;

  @Index()
  @Column({ type: "text", nullable: true })
  inviteeDeviceFingerprint: string | null;

  @Column({ default: "rewarded" })
  status: string;

  @Column({ type: "text", nullable: true })
  rejectReason: string | null;

  @Column({ type: "text", nullable: true })
  rewardSubscriptionId: string | null;

  // 被邀请人那一份 invite_reward 订阅；admin 拒兑时双边一起 revoke，否则只回退
  // inviter 这一份会留下"邀请人扣了，被邀请人没扣"的漏洞。
  @Column({ type: "text", nullable: true })
  inviteeRewardSubscriptionId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
