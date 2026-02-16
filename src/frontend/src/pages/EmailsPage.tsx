import { motion } from 'framer-motion';
import { Mail, Paperclip, ArrowRight, Loader2 } from 'lucide-react';
import { useEmails } from '@/hooks/useGodMode';

const sentimentStyle = {
  positive: 'bg-success/10 text-success',
  neutral: 'bg-muted text-muted-foreground',
  negative: 'bg-destructive/10 text-destructive',
};

const EmailsPage = () => {
  const { data: emails = [], isLoading } = useEmails();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Emails</h1>
        <span className="text-sm text-muted-foreground">{emails.length} threads processed</span>
      </div>

      <div className="space-y-2">
        {emails.map((email: any, i: number) => (
          <motion.div
            key={email.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-foreground">{email.subject}</h3>
                    {email.hasAttachments && <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-medium text-secondary-foreground">{email.from}</span>
                    <ArrowRight className="w-3 h-3 inline mx-1" />
                    {email.to?.join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{email.preview}</p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground">{email.date}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sentimentStyle[email.sentiment as keyof typeof sentimentStyle] || sentimentStyle.neutral}`}>{email.sentiment}</span>
                <span className="text-[10px] text-primary">{email.factsExtracted} facts</span>
              </div>
            </div>
          </motion.div>
        ))}
        {emails.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            No emails found for this project.
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailsPage;
