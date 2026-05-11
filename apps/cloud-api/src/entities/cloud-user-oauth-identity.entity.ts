import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("cloud_user_oauth_identities")
@Index("IDX_cloud_user_oauth_identities_provider_subject", ["provider", "providerSubject"], {
  unique: true,
})
@Index("IDX_cloud_user_oauth_identities_provider_user", ["provider", "userId"], {
  unique: true,
})
export class CloudUserOAuthIdentityEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "text" })
  userId: string;

  @Column({ type: "text" })
  provider: string;

  @Column({ type: "text" })
  providerSubject: string;

  @Column({ type: "text" })
  providerEmail: string;

  @Column({ type: "boolean", default: false })
  emailVerified: boolean;

  @Column({ type: "text", nullable: true })
  displayName: string | null;

  @Column({ type: "text", nullable: true })
  avatarUrl: string | null;

  @Column({ type: "text", nullable: true })
  rawProfile: string | null;

  @Column({ type: "datetime" })
  linkedAt: Date;

  @Column({ type: "datetime", nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
