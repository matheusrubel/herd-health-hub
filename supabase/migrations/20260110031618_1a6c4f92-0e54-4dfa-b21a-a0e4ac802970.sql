-- 1. Perfis (extende auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  fazenda TEXT,
  telefone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Responsáveis
CREATE TABLE public.responsaveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Dietas
CREATE TABLE public.dietas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  nome TEXT NOT NULL,
  consumo_diario_kg DECIMAL(10,2) NOT NULL,
  custo_por_kg DECIMAL(10,2) DEFAULT 0,
  tipo TEXT,
  composicao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Lotes
CREATE TABLE public.lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  nome TEXT NOT NULL,
  tipo_alimentacao TEXT,
  responsavel_id UUID REFERENCES public.responsaveis(id),
  dieta_id UUID REFERENCES public.dietas(id),
  capacidade INTEGER,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Animais (CORE)
CREATE TABLE public.animais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  numero_brinco TEXT NOT NULL,
  lote_id UUID REFERENCES public.lotes(id),
  peso_entrada DECIMAL(10,2) NOT NULL,
  data_entrada DATE NOT NULL,
  valor_aquisicao DECIMAL(10,2) DEFAULT 0,
  raca TEXT,
  sexo TEXT,
  idade_meses INTEGER,
  responsavel_id UUID REFERENCES public.responsaveis(id),
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, numero_brinco)
);

-- 6. Pesagens (CORE)
CREATE TABLE public.pesagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  animal_id UUID REFERENCES public.animais(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  peso DECIMAL(10,2) NOT NULL,
  responsavel_id UUID REFERENCES public.responsaveis(id),
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Gastos
CREATE TABLE public.gastos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  data DATE NOT NULL,
  tipo TEXT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  descricao TEXT NOT NULL,
  aplicacao TEXT,
  lote_id UUID REFERENCES public.lotes(id),
  animal_id UUID REFERENCES public.animais(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Protocolos Sanitários
CREATE TABLE public.protocolos_sanitarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  data DATE NOT NULL,
  tipo TEXT NOT NULL,
  produto TEXT NOT NULL,
  dose TEXT,
  custo DECIMAL(10,2) DEFAULT 0,
  aplicacao TEXT,
  lote_id UUID REFERENCES public.lotes(id),
  animal_id UUID REFERENCES public.animais(id),
  responsavel_id UUID REFERENCES public.responsaveis(id),
  proxima_dose DATE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Histórico de Movimentações entre Lotes
CREATE TABLE public.movimentacoes_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  animal_id UUID REFERENCES public.animais(id) ON DELETE CASCADE,
  lote_origem_id UUID REFERENCES public.lotes(id),
  lote_destino_id UUID REFERENCES public.lotes(id),
  data DATE NOT NULL,
  motivo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Logs de Exclusão de Lotes (Auditoria)
CREATE TABLE public.logs_exclusao_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  lote_id UUID NOT NULL,
  lote_nome TEXT,
  acao TEXT,
  animais_afetados INT DEFAULT 0,
  lote_destino_id UUID,
  detalhes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS em TODAS as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dietas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.animais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos_sanitarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_exclusao_lotes ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas RLS para responsaveis
CREATE POLICY "Users can view their own responsaveis" ON public.responsaveis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own responsaveis" ON public.responsaveis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own responsaveis" ON public.responsaveis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own responsaveis" ON public.responsaveis FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para dietas
CREATE POLICY "Users can view their own dietas" ON public.dietas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own dietas" ON public.dietas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own dietas" ON public.dietas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own dietas" ON public.dietas FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para lotes
CREATE POLICY "Users can view their own lotes" ON public.lotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own lotes" ON public.lotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own lotes" ON public.lotes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own lotes" ON public.lotes FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para animais
CREATE POLICY "Users can view their own animais" ON public.animais FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own animais" ON public.animais FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own animais" ON public.animais FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own animais" ON public.animais FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para pesagens
CREATE POLICY "Users can view their own pesagens" ON public.pesagens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own pesagens" ON public.pesagens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pesagens" ON public.pesagens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pesagens" ON public.pesagens FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para gastos
CREATE POLICY "Users can view their own gastos" ON public.gastos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own gastos" ON public.gastos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own gastos" ON public.gastos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own gastos" ON public.gastos FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para protocolos_sanitarios
CREATE POLICY "Users can view their own protocolos" ON public.protocolos_sanitarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own protocolos" ON public.protocolos_sanitarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own protocolos" ON public.protocolos_sanitarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own protocolos" ON public.protocolos_sanitarios FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para movimentacoes_lotes
CREATE POLICY "Users can view their own movimentacoes" ON public.movimentacoes_lotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own movimentacoes" ON public.movimentacoes_lotes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas RLS para logs_exclusao_lotes
CREATE POLICY "Users can view their own logs" ON public.logs_exclusao_lotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own logs" ON public.logs_exclusao_lotes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Índices para Performance
CREATE INDEX idx_animais_user_lote ON public.animais(user_id, lote_id) WHERE ativo = true;
CREATE INDEX idx_animais_brinco ON public.animais(user_id, numero_brinco);
CREATE INDEX idx_pesagens_animal_data ON public.pesagens(animal_id, data DESC);
CREATE INDEX idx_gastos_user_data ON public.gastos(user_id, data DESC);
CREATE INDEX idx_protocolos_user_data ON public.protocolos_sanitarios(user_id, data DESC);
CREATE INDEX idx_movimentacoes_animal ON public.movimentacoes_lotes(animal_id, data DESC);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_animais_updated_at BEFORE UPDATE ON public.animais
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lotes_updated_at BEFORE UPDATE ON public.lotes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_responsaveis_updated_at BEFORE UPDATE ON public.responsaveis
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dietas_updated_at BEFORE UPDATE ON public.dietas
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome_completo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome_completo', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();