import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateOnly } from '@/lib/date';
import { Syringe, Calendar, User, DollarSign, Package, Beef, FileText } from 'lucide-react';

interface Protocolo {
  id: string;
  data: string;
  tipo: string;
  produto: string;
  dose?: string | null;
  custo?: number | null;
  aplicacao?: string | null;
  proxima_dose?: string | null;
  observacoes?: string | null;
  lotes?: { nome: string } | null;
  animais?: { numero_brinco: string } | null;
  responsaveis?: { nome: string } | null;
}

interface ProtocoloDetalhesModalProps {
  protocolo: Protocolo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProtocoloDetalhesModal({ protocolo, open, onOpenChange }: ProtocoloDetalhesModalProps) {
  if (!protocolo) return null;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getAplicacaoLabel = () => {
    if (protocolo.aplicacao === 'todos') return 'Todos os animais';
    if (protocolo.aplicacao === 'lote' && protocolo.lotes) return `Lote: ${protocolo.lotes.nome}`;
    if (protocolo.aplicacao === 'animal' && protocolo.animais) return `Animal: #${protocolo.animais.numero_brinco}`;
    return 'Não especificado';
  };

  const getTipoBadgeVariant = () => {
    switch (protocolo.tipo) {
      case 'Vacina':
        return 'default';
      case 'Vermífugo':
        return 'secondary';
      case 'Antibiótico':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-primary" />
            Detalhes do Protocolo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Cabeçalho com tipo e produto */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <Badge variant={getTipoBadgeVariant()}>{protocolo.tipo}</Badge>
              <span className="text-sm text-muted-foreground">
                {format(parseDateOnly(protocolo.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </span>
            </div>
            <h3 className="text-lg font-semibold">{protocolo.produto}</h3>
          </div>

          {/* Detalhes em grid */}
          <div className="grid gap-3">
            {/* Dose */}
            {protocolo.dose && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Dose</p>
                  <p className="font-medium">{protocolo.dose}</p>
                </div>
              </div>
            )}

            {/* Aplicação */}
            <div className="flex items-center gap-3 rounded-lg border p-3">
              {protocolo.aplicacao === 'animal' ? (
                <Beef className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Package className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-xs text-muted-foreground">Aplicação</p>
                <p className="font-medium">{getAplicacaoLabel()}</p>
              </div>
            </div>

            {/* Custo */}
            {protocolo.custo && protocolo.custo > 0 && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <DollarSign className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="font-medium text-primary">{formatCurrency(protocolo.custo)}</p>
                </div>
              </div>
            )}

            {/* Responsável */}
            {protocolo.responsaveis && (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <User className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  <p className="font-medium">{protocolo.responsaveis.nome}</p>
                </div>
              </div>
            )}

            {/* Próxima Dose */}
            {protocolo.proxima_dose && (
              <div className="flex items-center gap-3 rounded-lg border border-warning/50 bg-warning/5 p-3">
                <Calendar className="h-5 w-5 text-warning" />
                <div>
                  <p className="text-xs text-muted-foreground">Próxima Dose</p>
                  <p className="font-medium">
                    {format(parseDateOnly(protocolo.proxima_dose), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            )}

            {/* Observações */}
            {protocolo.observacoes && (
              <div className="rounded-lg border p-3">
                <div className="mb-1 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Observações</p>
                </div>
                <p className="text-sm">{protocolo.observacoes}</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
